import "server-only";
import { prisma } from "@/lib/db";

export type Segment = "novo" | "ativo" | "em_risco" | "inativo";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  orders: number;
  totalSpent: number;
  avgTicket: number;
  lastDays: number | null; // dias desde a última compra
  segment: Segment;
  dueRepurchase: boolean; // previsto para recomprar (passou do intervalo médio)
}

export interface CrmInsights {
  customers: CustomerRow[];
  counts: Record<Segment, number>;
  total: number;
  ticketMedio: number;
  dueList: CustomerRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

export async function getCustomerInsights(orgId: string): Promise<CrmInsights> {
  const [customers, sales] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId: orgId } }),
    prisma.sale.findMany({
      where: { organizationId: orgId, customerId: { not: null } },
      select: { customerId: true, total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Agrega vendas por cliente.
  const agg = new Map<
    string,
    { orders: number; total: number; dates: Date[] }
  >();
  for (const s of sales) {
    const k = s.customerId as string;
    const e = agg.get(k) ?? { orders: 0, total: 0, dates: [] };
    e.orders += 1;
    e.total += s.total;
    e.dates.push(s.createdAt);
    agg.set(k, e);
  }

  const now = Date.now();
  const counts: Record<Segment, number> = {
    novo: 0,
    ativo: 0,
    em_risco: 0,
    inativo: 0,
  };

  const rows: CustomerRow[] = customers.map((c) => {
    const e = agg.get(c.id);
    const orders = e?.orders ?? 0;
    const total = round2(e?.total ?? 0);
    const avgTicket = orders ? round2(total / orders) : 0;
    const last = e && e.dates.length ? e.dates[e.dates.length - 1] : null;
    const lastDays = last ? Math.floor((now - last.getTime()) / DAY) : null;

    // Intervalo médio entre compras (para prever recompra).
    let avgInterval: number | null = null;
    if (e && e.dates.length >= 2) {
      let sum = 0;
      for (let i = 1; i < e.dates.length; i++)
        sum += (e.dates[i].getTime() - e.dates[i - 1].getTime()) / DAY;
      avgInterval = sum / (e.dates.length - 1);
    }

    let segment: Segment;
    if (orders === 0) segment = "novo";
    else if (lastDays !== null && lastDays <= 30) segment = "ativo";
    else if (lastDays !== null && lastDays <= 60) segment = "em_risco";
    else segment = "inativo";
    counts[segment] += 1;

    const dueRepurchase =
      orders >= 2 &&
      avgInterval !== null &&
      lastDays !== null &&
      lastDays >= avgInterval;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      orders,
      totalSpent: total,
      avgTicket,
      lastDays,
      segment,
      dueRepurchase,
    };
  });

  rows.sort((a, b) => b.totalSpent - a.totalSpent);

  const withOrders = rows.filter((r) => r.orders > 0);
  const ticketMedio = withOrders.length
    ? round2(
        withOrders.reduce((s, r) => s + r.totalSpent, 0) / withOrders.length,
      )
    : 0;

  const dueList = rows
    .filter((r) => r.dueRepurchase)
    .sort((a, b) => (b.lastDays ?? 0) - (a.lastDays ?? 0));

  return { customers: rows, counts, total: customers.length, ticketMedio, dueList };
}
