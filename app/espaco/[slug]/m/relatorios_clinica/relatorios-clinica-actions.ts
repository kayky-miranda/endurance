"use server";

import { requirePermission } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { withAiCredit } from "@/lib/endurance/ai-credits";
import { parsePeriod } from "@/lib/endurance/period";
import { periodLabel } from "@/lib/endurance/period";
import { getProductivityReport } from "@/lib/endurance/productivity";
import { getCommissionReport } from "@/lib/endurance/commissions";
import { generateClinicInsights } from "@/lib/endurance/clinic-insights";
import type { Insight } from "@/lib/endurance/sales-insights";

/**
 * Insights gerenciais dos Relatórios da clínica (IA opcional + fallback). Gate
 * finance.reports (mesma permissão do módulo) + rate limit por usuário — pode
 * chamar a IA. Recalcula o relatório do período no servidor (a UI só manda os
 * dias) para nunca confiar em agregados vindos do cliente.
 */
export type ClinicInsightsResult =
  | { ok: true; insights: Insight[]; source: "ai" | "heuristic" }
  | { ok: false; error: string };

export async function clinicInsightsAction(
  dias?: string,
): Promise<ClinicInsightsResult> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  if (!(await hit(`clinic:insights:${s.sub}`, 12, 60_000)).ok)
    return { ok: false, error: "Muitas análises seguidas. Aguarde um instante." };

  const days = parsePeriod({ dias }, 30);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const [report, commissions] = await Promise.all([
    getProductivityReport(s.org, from, to),
    getCommissionReport(s.org, from, to),
  ]);

  const input = {
    periodLabel: periodLabel(days),
    report,
    totalCommission: commissions.totalCommission,
  };
  const out = await withAiCredit(s.org, "clinic_insights", async () => {
    const r = await generateClinicInsights(input);
    return { value: r, delivered: r.source === "ai", fallback: r.source !== "ai" };
  });
  // Sem crédito o recurso NÃO some: entrega a leitura determinística.
  const res = out.ok ? out.value : await generateClinicInsights(input);
  return { ok: true, insights: res.insights, source: res.source };
}
