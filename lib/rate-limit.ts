import "server-only";
import { headers } from "next/headers";

/**
 * Rate limit em memória por janela fixa, para proteger as actions públicas
 * (login/onboarding) de força bruta e abuso automatizado.
 *
 * Por ser em memória, o estado é por instância do servidor — em serverless
 * cada lambda tem o seu contador, então é uma proteção de primeira camada
 * (suficiente contra rajadas num mesmo processo). Para garantia global em
 * produção, combine com a proteção da plataforma (ex.: Vercel WAF/Firewall).
 */

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

export interface RateVerdict {
  ok: boolean;
  /** Segundos até a janela liberar (0 quando ok). */
  retryAfterSec: number;
}

/** Consome 1 tentativa da janela e diz se ainda está dentro do limite. */
export function hit(key: string, limit: number, windowMs: number): RateVerdict {
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
