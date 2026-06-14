import "server-only";
import { prisma } from "@/lib/db";

/**
 * Telemetria de IA por organização.
 *
 * Cada chamada a um provedor (ou queda na heurística offline) vira um registro
 * em AiUsage: feature, provedor/modelo, tokens, latência e resultado. Serve
 * para acompanhar custo e confiabilidade por tenant — e dimensionar cota.
 */

export type AiFeature =
  | "assistant"
  | "onboarding"
  | "sales_insights"
  | "stock_advice"
  | "crm_campaigns"
  | "pricing_advice";

export interface AiUsageEvent {
  /** Nulo nas chamadas pré-tenant (onboarding antes do signup). */
  organizationId?: string | null;
  feature: AiFeature;
  provider: "gemini" | "anthropic" | "offline";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  ok?: boolean;
  /** true quando o recurso resolveu pela heurística offline. */
  fallback?: boolean;
  error?: string;
}

const int = (n: number | undefined) => Math.max(0, Math.round(n ?? 0));

/**
 * Registro fire-and-forget: telemetria nunca derruba nem atrasa o fluxo que a
 * gerou — falha vira só um log no servidor.
 */
export function recordAiUsage(e: AiUsageEvent): void {
  void prisma.aiUsage
    .create({
      data: {
        organizationId: e.organizationId ?? null,
        feature: e.feature,
        provider: e.provider,
        model: (e.model ?? "").slice(0, 60),
        inputTokens: int(e.inputTokens),
        outputTokens: int(e.outputTokens),
        latencyMs: int(e.latencyMs),
        ok: e.ok ?? true,
        fallback: e.fallback ?? false,
        error: (e.error ?? "").slice(0, 300),
      },
    })
    .catch((err) => console.error("[ai-telemetry] falha ao registrar:", err));
}

export interface AiUsageSummary {
  days: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  fallbacks: number;
  avgLatencyMs: number;
  byFeature: {
    feature: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }[];
}

/** Resumo agregado (no SQL) do uso de IA de uma organização. */
export async function getAiUsageSummary(
  org: string,
  days = 30,
): Promise<AiUsageSummary> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const where = { organizationId: org, createdAt: { gte: since } };

  const [totals, byFeature, errors, fallbacks] = await Promise.all([
    prisma.aiUsage.aggregate({
      where,
      _count: true,
      _sum: { inputTokens: true, outputTokens: true },
      _avg: { latencyMs: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["feature"],
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
      orderBy: { _count: { feature: "desc" } },
    }),
    prisma.aiUsage.count({ where: { ...where, ok: false } }),
    prisma.aiUsage.count({ where: { ...where, fallback: true } }),
  ]);

  return {
    days,
    calls: totals._count,
    inputTokens: totals._sum.inputTokens ?? 0,
    outputTokens: totals._sum.outputTokens ?? 0,
    errors,
    fallbacks,
    avgLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
    byFeature: byFeature.map((f) => ({
      feature: f.feature,
      calls: f._count._all,
      inputTokens: f._sum.inputTokens ?? 0,
      outputTokens: f._sum.outputTokens ?? 0,
    })),
  };
}

/** Rótulos das features para a interface. */
export const AI_FEATURE_LABEL: Record<string, string> = {
  assistant: "Assistente (Gerente IA)",
  onboarding: "Onboarding",
  sales_insights: "Insights de vendas",
  stock_advice: "Conselho de estoque",
  crm_campaigns: "Campanhas de CRM",
  pricing_advice: "Conselho de precificação",
};
