"use server";

import { getSession } from "@/lib/auth";
import { withAiCredit } from "@/lib/endurance/ai-credits";
import { getSalesSummary } from "@/lib/endurance/sales-analytics";
import {
  generateSalesInsights,
  type Insight,
} from "@/lib/endurance/sales-insights";
import { getStockAlerts } from "@/lib/endurance/stock-alerts";
import { generateStockAdvice } from "@/lib/endurance/stock-advice";
import { getCustomerInsights } from "@/lib/endurance/crm";
import { generateCrmCampaigns } from "@/lib/endurance/crm-campaigns";
import { getPricingAnalysis } from "@/lib/endurance/pricing";
import { generatePricingAdvice } from "@/lib/endurance/pricing-advice";

/**
 * Recursos de IA analítica (vendas, estoque, CRM, precificação).
 *
 * Todos têm fallback heurístico determinístico. Quando ele entra em ação o
 * MODELO NÃO FOI CHAMADO — então `delivered: false` devolve o crédito: o cliente
 * recebeu a versão calculada, que não custa nada para produzir. Cobrar ali seria
 * cobrar por uma conta que o próprio sistema fez.
 *
 * Sem saldo, o recurso não fica indisponível: cai direto na heurística, que é a
 * degradação elegante que o produto já tinha. O que se perde é a leitura em
 * linguagem natural, não a informação.
 */

export async function salesInsightsAction(): Promise<
  { ok: true; insights: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const summary = await getSalesSummary(s.org, 30);

  const out = await withAiCredit(s.org, "sales_insights", async () => {
    const r = await generateSalesInsights(summary);
    return { value: r, delivered: r.source === "ai", fallback: r.source !== "ai" };
  });
  if (out.ok) return { ok: true, ...out.value };

  // Sem crédito: entrega a versão determinística em vez de negar o recurso.
  const fallback = await generateSalesInsights(summary);
  return { ok: true, ...fallback };
}

export async function stockAdviceAction(): Promise<
  { ok: true; text: string; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const alerts = await getStockAlerts(s.org, 14);

  const out = await withAiCredit(s.org, "stock_advice", async () => {
    const r = await generateStockAdvice(alerts);
    return { value: r, delivered: r.source === "ai", fallback: r.source !== "ai" };
  });
  if (out.ok) return { ok: true, ...out.value };

  const fallback = await generateStockAdvice(alerts);
  return { ok: true, ...fallback };
}

export async function crmCampaignsAction(): Promise<
  { ok: true; campaigns: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const ci = await getCustomerInsights(s.org);

  const out = await withAiCredit(s.org, "crm_campaigns", async () => {
    const r = await generateCrmCampaigns(ci);
    return { value: r, delivered: r.source === "ai", fallback: r.source !== "ai" };
  });
  if (out.ok) return { ok: true, ...out.value };

  const fallback = await generateCrmCampaigns(ci);
  return { ok: true, ...fallback };
}

export async function pricingAdviceAction(): Promise<
  { ok: true; tips: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const a = await getPricingAnalysis(s.org, 30);

  const out = await withAiCredit(s.org, "pricing_advice", async () => {
    const r = await generatePricingAdvice(a);
    return { value: r, delivered: r.source === "ai", fallback: r.source !== "ai" };
  });
  if (out.ok) return { ok: true, ...out.value };

  const fallback = await generatePricingAdvice(a);
  return { ok: true, ...fallback };
}
