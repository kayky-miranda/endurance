import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

export type ReplenLevel = "rompido" | "critico" | "atencao" | "ok";

export interface ReplenItem {
  id: string;
  name: string;
  stock: number;
  avgDaily: number;
  forecast7: number;
  forecast14: number;
  daysLeft: number | null;
  suggestedQty: number;
  estCost: number;
  level: ReplenLevel;
}

export interface Replenishment {
  items: ReplenItem[]; // só os que precisam de reposição (suggestedQty > 0)
  totalCost: number;
  needing: number;
}

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Previsão de demanda + reposição automática. Usa a média de venda/dia (janela)
 * para projetar demanda (7/14 dias) e sugerir quanto comprar para cobrir
 * `coverageDays`. Tudo escopado por organização e com agregação enxuta.
 */
export async function getReplenishment(
  orgId: string,
  opts?: { windowDays?: number; coverageDays?: number },
): Promise<Replenishment> {
  const windowDays = opts?.windowDays ?? 14;
  const coverageDays = opts?.coverageDays ?? 14;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
  });
  if (products.length === 0) return { items: [], totalCost: 0, needing: 0 };

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

  const items: ReplenItem[] = [];
  let totalCost = 0;
  let needing = 0;

  for (const p of products) {
    const avgDaily = (sold.get(p.id) ?? 0) / windowDays;
    const daysLeft = avgDaily > 0 ? p.stock / avgDaily : null;

    let suggestedQty = Math.max(
      0,
      Math.ceil(avgDaily * coverageDays) - p.stock,
    );
    if (avgDaily === 0 && p.stock <= 3)
      suggestedQty = Math.max(suggestedQty, 5);

    let level: ReplenLevel = "ok";
    if (p.stock <= 0) level = "rompido";
    else if (daysLeft !== null && daysLeft <= 3) level = "critico";
    else if ((daysLeft !== null && daysLeft <= 7) || p.stock <= 5)
      level = "atencao";

    const estCost = round(suggestedQty * money(p.cost), 2);
    if (suggestedQty > 0) {
      needing++;
      totalCost += estCost;
    }

    items.push({
      id: p.id,
      name: p.name,
      stock: p.stock,
      avgDaily: round(avgDaily, 2),
      forecast7: Math.ceil(avgDaily * 7),
      forecast14: Math.ceil(avgDaily * 14),
      daysLeft: daysLeft === null ? null : round(daysLeft),
      suggestedQty,
      estCost,
      level,
    });
  }

  const lvl: Record<ReplenLevel, number> = {
    rompido: 0,
    critico: 1,
    atencao: 2,
    ok: 3,
  };
  const needList = items
    .filter((i) => i.suggestedQty > 0)
    .sort(
      (a, b) =>
        lvl[a.level] - lvl[b.level] ||
        (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999),
    );

  return { items: needList, totalCost: round(totalCost, 2), needing };
}
