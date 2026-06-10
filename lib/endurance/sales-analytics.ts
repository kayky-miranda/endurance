import "server-only";
import { prisma } from "@/lib/db";

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
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

/** Agrega as vendas reais da organização em KPIs e séries para o painel. */
export async function getSalesSummary(
  orgId: string,
  days = 30,
): Promise<SalesSummary> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const sales = await prisma.sale.findMany({
    where: { organizationId: orgId, createdAt: { gte: since } },
    include: { items: true, payments: true, seller: true },
    orderBy: { createdAt: "asc" },
  });

  const faturamento = sum(sales.map((s) => s.total));
  const vendas = sales.length;
  const ticketMedio = vendas ? faturamento / vendas : 0;
  const itens = sum(sales.map((s) => s.itemsCount));

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todays = sales.filter((s) => s.createdAt >= startToday);

  // Top produtos (por quantidade).
  const prod = new Map<string, { qty: number; revenue: number }>();
  for (const s of sales)
    for (const it of s.items) {
      const e = prod.get(it.name) ?? { qty: 0, revenue: 0 };
      e.qty += it.quantity;
      e.revenue += it.quantity * it.unitPrice;
      prod.set(it.name, e);
    }
  const topProdutos = [...prod.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: round2(v.revenue) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Formas de pagamento.
  const pay = new Map<string, number>();
  for (const s of sales)
    for (const p of s.payments) pay.set(p.method, (pay.get(p.method) ?? 0) + p.amount);
  const pagamentos = [...pay.entries()]
    .map(([method, amount]) => ({ method, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  // Vendas por dia (últimos min(days,14)).
  const span = Math.min(days, 14);
  const porDia: { date: string; total: number }[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const total = sum(
      sales
        .filter((s) => s.createdAt >= d && s.createdAt < next)
        .map((s) => s.total),
    );
    porDia.push({ date: d.toISOString().slice(0, 10), total: round2(total) });
  }

  // Ranking de vendedores.
  const seller = new Map<string, { total: number; vendas: number }>();
  for (const s of sales) {
    const name = s.seller?.name ?? "—";
    const e = seller.get(name) ?? { total: 0, vendas: 0 };
    e.total += s.total;
    e.vendas += 1;
    seller.set(name, e);
  }
  const vendedores = [...seller.entries()]
    .map(([name, v]) => ({ name, total: round2(v.total), vendas: v.vendas }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    days,
    faturamento: round2(faturamento),
    vendas,
    ticketMedio: round2(ticketMedio),
    itens,
    hojeFaturamento: round2(sum(todays.map((s) => s.total))),
    hojeVendas: todays.length,
    topProdutos,
    pagamentos,
    porDia,
    vendedores,
  };
}
