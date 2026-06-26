import "server-only";
import { prisma } from "@/lib/db";

/**
 * Fonte única de verdade do estado do sistema. Consumida pelo endpoint
 * /api/health (uptime externo, JSON) e pela página pública /status (humanos).
 *
 * `down` = dependência crítica caiu (afeta `ok`). `info` = nota de
 * configuração que não derruba o serviço (ex.: e-mail em modo stub).
 */

export type CheckLevel = "ok" | "down" | "info";

export interface HealthCheck {
  key: string;
  label: string;
  level: CheckLevel;
  detail: string;
  latencyMs?: number;
}

export interface HealthReport {
  /** true se nenhuma dependência crítica está `down`. */
  ok: boolean;
  checks: HealthCheck[];
  uptimeSec: number;
  version: string;
  checkedAt: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - t;
    return {
      key: "database",
      label: "Banco de dados",
      level: "ok",
      detail: `Operacional · ${latencyMs}ms`,
      latencyMs,
    };
  } catch {
    return {
      key: "database",
      label: "Banco de dados",
      level: "down",
      detail: "Sem conexão",
    };
  }
}

function checkEmail(): HealthCheck {
  const configured = Boolean(process.env.RESEND_API_KEY);
  return {
    key: "email",
    label: "E-mail transacional",
    level: configured ? "ok" : "info",
    detail: configured ? "Operacional (Resend)" : "Modo stub — sem RESEND_API_KEY",
  };
}

export async function getHealthReport(): Promise<HealthReport> {
  const checks: HealthCheck[] = [await checkDatabase(), checkEmail()];

  return {
    ok: checks.every((c) => c.level !== "down"),
    checks,
    uptimeSec: Math.floor(process.uptime()),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    checkedAt: new Date().toISOString(),
  };
}
