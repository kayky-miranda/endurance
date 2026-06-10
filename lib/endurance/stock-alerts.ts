import "server-only";
import { prisma } from "@/lib/db";

export type AlertLevel = "rompido" | "critico" | "atencao";

export interface StockAlert {
  id: string;
  name: string;
  stock: number;
  soldPerDay: number;
  daysLeft: number | null; // null = sem histórico de venda
  level: AlertLevel;
  suggestedReorder: number;
}

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/**
 * Previsão de ruptura: cruza o estoque atual com a velocidade de venda
 * (unidades/dia nos últimos `days`) para estimar quantos dias faltam até acabar
 * e sugerir reposição. É a base da "IA preventiva" de estoque.
 */
export async function getStockAlerts(
  orgId: string,
  days = 14,
): Promise<StockAlert[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
  });
  if (products.length === 0) return [];

  const items = await prisma.saleItem.findMany({
    where: {
      productId: { in: products.map((p) => p.id) },
      sale: { organizationId: orgId, createdAt: { gte: since } },
    },
    select: { productId: true, quantity: true },
  });

  const sold = new Map<string, number>();
  for (const it of items)
    if (it.productId)
      sold.set(it.productId, (sold.get(it.productId) ?? 0) + it.quantity);

  const alerts: StockAlert[] = [];
  for (const p of products) {
    const perDay = (sold.get(p.id) ?? 0) / days;
    const daysLeft = perDay > 0 ? p.stock / perDay : null;

    let level: AlertLevel | null = null;
    if (p.stock <= 0) level = "rompido";
    else if (daysLeft !== null && daysLeft <= 3) level = "critico";
    else if ((daysLeft !== null && daysLeft <= 7) || p.stock <= 5)
      level = "atencao";
    if (!level) continue;

    // Sugere repor para cobrir ~14 dias de venda (mínimo 10 se não há histórico).
    const target = perDay > 0 ? Math.ceil(perDay * 14) : 10;
    alerts.push({
      id: p.id,
      name: p.name,
      stock: p.stock,
      soldPerDay: round(perDay, 2),
      daysLeft: daysLeft === null ? null : round(daysLeft),
      level,
      suggestedReorder: Math.max(0, target - p.stock),
    });
  }

  const order: Record<AlertLevel, number> = {
    rompido: 0,
    critico: 1,
    atencao: 2,
  };
  return alerts.sort(
    (a, b) =>
      order[a.level] - order[b.level] ||
      (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999),
  );
}
