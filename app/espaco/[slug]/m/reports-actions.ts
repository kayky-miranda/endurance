"use server";

import { getSession } from "@/lib/auth";
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

export async function salesInsightsAction(): Promise<
  { ok: true; insights: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const summary = await getSalesSummary(s.org, 30);
  const { insights, source } = await generateSalesInsights(summary);
  return { ok: true, insights, source };
}

export async function stockAdviceAction(): Promise<
  { ok: true; text: string; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const alerts = await getStockAlerts(s.org, 14);
  const { text, source } = await generateStockAdvice(alerts);
  return { ok: true, text, source };
}

export async function crmCampaignsAction(): Promise<
  { ok: true; campaigns: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const ci = await getCustomerInsights(s.org);
  const { campaigns, source } = await generateCrmCampaigns(ci);
  return { ok: true, campaigns, source };
}

export async function pricingAdviceAction(): Promise<
  { ok: true; tips: Insight[]; source: "ai" | "heuristic" } | { ok: false }
> {
  const s = await getSession();
  if (!s) return { ok: false };
  const a = await getPricingAnalysis(s.org, 30);
  const { tips, source } = await generatePricingAdvice(a);
  return { ok: true, tips, source };
}
