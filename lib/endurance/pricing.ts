import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

export type MarginLevel = "negativa" | "baixa" | "ok";

export interface PricingRow {
  id: string;
  name: string;
  price: number;
  cost: number;
  margin: number; // % sobre o preço (lucro / preço)
  markup: number; // % sobre o custo (lucro / custo)
  soldQty: number; // unidades no período
  profit: number; // lucro no período
  soldPerDay: number;
  level: MarginLevel;
}

export interface PricingAnalysis {
  rows: PricingRow[];
  avgMargin: number;
  grossProfit: number;
  lowMarginCount: number;
  windowDays: number;
}

const LOW_MARGIN = 20; // % — abaixo disso é "margem baixa"
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getPricingAnalysis(
  orgId: string,
  windowDays = 30,
): Promise<PricingAnalysis> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
  });
  const sales = await prisma.saleItem.findMany({
    where: {
      productId: { in: products.map((p) => p.id) },
      sale: { organizationId: orgId, createdAt: { gte: since } },
    },
    select: { productId: true, quantity: true },
  });
  const sold = new Map<string, number>();
  for (const it of sales)
    if (it.productId)
      sold.set(it.productId, (sold.get(it.productId) ?? 0) + it.quantity);

  const rows: PricingRow[] = products.map((p) => {
    const price = money(p.price);
    const cost = money(p.cost);
    const unitProfit = price - cost;
    const margin = price > 0 ? (unitProfit / price) * 100 : 0;
    const markup = cost > 0 ? (unitProfit / cost) * 100 : price > 0 ? 100 : 0;
    const soldQty = sold.get(p.id) ?? 0;

    let level: MarginLevel = "ok";
    if (unitProfit < 0) level = "negativa";
    else if (margin < LOW_MARGIN) level = "baixa";

    return {
      id: p.id,
      name: p.name,
      price,
      cost,
      margin: round2(margin),
      markup: round2(markup),
      soldQty,
      profit: round2(unitProfit * soldQty),
      soldPerDay: round2(soldQty / windowDays),
      level,
    };
  });

  rows.sort((a, b) => a.margin - b.margin); // piores margens primeiro

  return {
    rows,
    avgMargin: rows.length
      ? round2(rows.reduce((s, r) => s + r.margin, 0) / rows.length)
      : 0,
    grossProfit: round2(rows.reduce((s, r) => s + r.profit, 0)),
    lowMarginCount: rows.filter((r) => r.level !== "ok").length,
    windowDays,
  };
}
