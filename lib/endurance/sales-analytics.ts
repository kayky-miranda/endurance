import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

export interface SalesSummary {
  days: number;
  faturamento: number;
  vendas: number;
  ticketMedio: number;
  itens: number;
  hojeFaturamento: number;
  hojeVendas: number;
  topProdutos: { name: string; qty: number; revenue: number }[];
  pagamentos: { method: string; amount: number }[];
  porDia: { date: string; total: number }[];
  vendedores: { name: string; total: number; vendas: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Agrega as vendas reais da organização em KPIs e séries para o painel.
 * Tudo agregado NO BANCO (aggregate/groupBy/SQL) — nada de carregar as vendas
 * do período em memória: com 100k vendas/ano o custo fica no Postgres.
 */
export async function getSalesSummary(
  orgId: string,
  days = 30,
): Promise<SalesSummary> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const [agg, aggToday, payRows, topRows, dayRows, sellerRows] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { organizationId: orgId, createdAt: { gte: since } },
        _count: true,
        _sum: { total: true, itemsCount: true },
      }),
      prisma.sale.aggregate({
        where: { organizationId: orgId, createdAt: { gte: startToday } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.salePayment.groupBy({
        by: ["method"],
        where: { sale: { organizationId: orgId, createdAt: { gte: since } } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ name: string; qty: number; revenue: number }[]>`
        SELECT i."name",
               SUM(i."quantity")::int                         AS qty,
               SUM(i."quantity" * i."unitPrice")::float8      AS revenue
        FROM "SaleItem" i
        JOIN "Sale" s ON s."id" = i."saleId"
        WHERE s."organizationId" = ${orgId} AND s."createdAt" >= ${since}
        GROUP BY i."name"
        ORDER BY qty DESC
        LIMIT 5`,
      prisma.$queryRaw<{ date: string; total: number }[]>`
        SELECT to_char(date_trunc('day', s."createdAt"), 'YYYY-MM-DD') AS date,
               SUM(s."total")::float8                                  AS total
        FROM "Sale" s
        WHERE s."organizationId" = ${orgId} AND s."createdAt" >= ${since}
        GROUP BY 1`,
      prisma.$queryRaw<{ name: string; total: number; vendas: number }[]>`
        SELECT COALESCE(u."name", '—') AS name,
               SUM(s."total")::float8  AS total,
               COUNT(*)::int           AS vendas
        FROM "Sale" s
        LEFT JOIN "User" u ON u."id" = s."userId"
        WHERE s."organizationId" = ${orgId} AND s."createdAt" >= ${since}
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 5`,
    ]);

  const faturamento = money(agg._sum.total ?? 0);
  const vendas = agg._count;

  const pagamentos = payRows
    .map((p) => ({ method: p.method, amount: round2(money(p._sum.amount ?? 0)) }))
    .sort((a, b) => b.amount - a.amount);

  const topProdutos = topRows.map((r) => ({
    name: r.name,
    qty: r.qty,
    revenue: round2(r.revenue),
  }));

  // Série diária contínua (preenche dias sem venda com 0).
  const byDay = new Map(dayRows.map((r) => [r.date, r.total]));
  const span = Math.min(days, 14);
  const porDia: { date: string; total: number }[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    porDia.push({ date: key, total: round2(byDay.get(key) ?? 0) });
  }

  const vendedores = sellerRows.map((r) => ({
    name: r.name,
    total: round2(r.total),
    vendas: r.vendas,
  }));

  return {
    days,
    faturamento: round2(faturamento),
    vendas,
    ticketMedio: round2(vendas ? faturamento / vendas : 0),
    itens: agg._sum.itemsCount ?? 0,
    hojeFaturamento: round2(money(aggToday._sum.total ?? 0)),
    hojeVendas: aggToday._count,
    topProdutos,
    pagamentos,
    porDia,
    vendedores,
  };
}
