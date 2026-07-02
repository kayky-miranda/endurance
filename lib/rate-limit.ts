import "server-only";
import { headers } from "next/headers";
import { logger } from "@/lib/logger";

/**
 * Rate limit por janela fixa.
 *
 * Em produção serverless, configure UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN: aí o contador é GLOBAL (compartilhado entre todas
 * as instâncias). Sem essas envs, cai num contador em MEMÓRIA por processo —
 * proteção de primeira camada contra rajadas no mesmo lambda.
 *
 * Falha aberta: se o Redis estiver indisponível, não derruba o app — loga e
 * usa o fallback em memória (disponibilidade > rigor do limite num hiccup).
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DISTRIBUTED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export interface RateVerdict {
  ok: boolean;
  /** Segundos até a janela liberar (0 quando ok). */
  retryAfterSec: number;
}

// ---------------------------------------------------------------------------
// Backend em memória (fallback / dev / camada secundária)
// ---------------------------------------------------------------------------
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

function hitMemory(key: string, limit: number, windowMs: number): RateVerdict {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit)
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// Backend distribuído (Upstash Redis via REST)
// ---------------------------------------------------------------------------
async function hitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateVerdict> {
  const windowStart = Math.floor(Date.now() / windowMs);
  const bucketKey = `rl:${key}:${windowStart}`;
  try {
    // Pipeline atômico: INCR (conta) + PEXPIRE (expira a janela).
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", bucketKey],
        ["PEXPIRE", bucketKey, windowMs],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`upstash_${res.status}`);
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (count > limit) {
      const resetAt = (windowStart + 1) * windowMs;
      return { ok: false, retryAfterSec: Math.ceil((resetAt - Date.now()) / 1000) };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch (e) {
    // Falha aberta com fallback em memória (mesma instância).
    logger.warn("rate-limit: Upstash indisponível — usando memória", {
      error: e instanceof Error ? e.message : String(e),
    });
    return hitMemory(key, limit, windowMs);
  }
}

/**
 * Relaxa os limites (×100) para suítes E2E, onde dezenas de signups/logins
 * saem do mesmo IP em minutos. Nunca ativa em produção, mesmo com a env.
 */
const RELAXED =
  process.env.RATE_LIMIT_RELAXED === "1" && process.env.NODE_ENV !== "production";

/** Consome 1 tentativa da janela e diz se ainda está dentro do limite. */
export async function hit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateVerdict> {
  const max = RELAXED ? limit * 100 : limit;
  return DISTRIBUTED
    ? hitRedis(key, max, windowMs)
    : hitMemory(key, max, windowMs);
}

// ---------------------------------------------------------------------------
// Lockout de tentativas (ex.: senha errada no login). Camada em memória por
// instância — o brute-force cross-instância já é coberto pelo `hit` por IP,
// que é distribuído quando o Upstash está configurado.
// ---------------------------------------------------------------------------

/** Verifica o limite SEM consumir tentativa (para checar antes de processar). */
export function peek(key: string, limit: number): RateVerdict {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now || b.count < limit)
    return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

/** Registra uma ocorrência (ex.: senha errada) sem precisar do veredito. */
export function record(key: string, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
}

/** IP do cliente (atrás de proxy usa o primeiro x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}
