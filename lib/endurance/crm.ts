import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  PAGE_SIZE,
  clampPage,
  pageMeta,
  type PageMeta,
} from "./pagination";

export type Segment = "novo" | "ativo" | "em_risco" | "inativo";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  orders: number;
  totalSpent: number;
  avgTicket: number;
  lastDays: number | null; // dias desde a última compra
  segment: Segment;
  dueRepurchase: boolean; // previsto para recomprar (passou do intervalo médio)
}

export interface CrmInsights {
  /** Página atual da tabela (compradores por gasto desc, depois os sem compra). */
  customers: CustomerRow[];
  counts: Record<Segment, number>;
  total: number;
  ticketMedio: number;
  /** Total de clientes previstos para recompra (KPI). */
  dueCount: number;
  /** Top da fila de recompra (ranking do CRM usa 5; notificações usam até 12). */
  dueTop: CustomerRow[];
  pageMeta: PageMeta;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

/** Estatísticas por cliente comprador, derivadas do groupBy de vendas. */
interface BuyerStat {
  customerId: string;
  orders: number;
  totalSpent: number;
  lastDays: number;
  segment: Segment;
  dueRepurchase: boolean;
}

export async function getCustomerInsights(
  orgId: string,
  rawPage = 1,
): Promise<CrmInsights> {
  // Agregação no SQL: uma linha por cliente comprador (count/sum/min/max),
  // em vez de carregar todas as vendas na aplicação.
  const [total, agg] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, customerId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
  ]);

  const now = Date.now();
  const buyers: BuyerStat[] = agg.map((g) => {
    const orders = g._count._all;
    const first = g._min.createdAt ?? new Date();
    const last = g._max.createdAt ?? first;
    const lastDays = Math.floor((now - last.getTime()) / DAY);
    // Intervalo médio entre compras = (última − primeira) / (n − 1).
    const avgInterval =
      orders >= 2 ? (last.getTime() - first.getTime()) / DAY / (orders - 1) : null;
    const segment: Segment =
      lastDays <= 30 ? "ativo" : lastDays <= 60 ? "em_risco" : "inativo";
    return {
      customerId: g.customerId as string,
      orders,
      totalSpent: round2(money(g._sum.total)),
      lastDays,
      segment,
      dueRepurchase: avgInterval !== null && lastDays >= avgInterval,
    };
  });

  const counts: Record<Segment, number> = {
    novo: total - buyers.length,
    ativo: 0,
    em_risco: 0,
    inativo: 0,
  };
  for (const b of buyers) counts[b.segment] += 1;

  const ticketMedio = buyers.length
    ? round2(buyers.reduce((s, b) => s + b.totalSpent, 0) / buyers.length)
    : 0;

  const due = buyers
    .filter((b) => b.dueRepurchase)
    .sort((a, b) => b.lastDays - a.lastDays);
  const dueTopStats = due.slice(0, 12);

  // Página da tabela: compradores ordenados por gasto desc; quando a página
  // passa do fim dessa lista, completa com os clientes sem compra ("novo").
  const page = clampPage(rawPage, total);
  const start = (page - 1) * PAGE_SIZE;
  const sorted = [...buyers].sort((a, b) => b.totalSpent - a.totalSpent);
  const pageBuyers = sorted.slice(start, start + PAGE_SIZE);
  const novosTake = PAGE_SIZE - pageBuyers.length;
  const novosSkip = Math.max(0, start - sorted.length);

  const wantedIds = Array.from(
    new Set([...pageBuyers, ...dueTopStats].map((b) => b.customerId)),
  );
  const [wanted, novos] = await Promise.all([
    wantedIds.length
      ? prisma.customer.findMany({ where: { id: { in: wantedIds } } })
      : Promise.resolve([]),
    novosTake > 0
      ? prisma.customer.findMany({
          where: { organizationId: orgId, sales: { none: {} } },
          orderBy: { createdAt: "desc" },
          skip: novosSkip,
          take: novosTake,
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(wanted.map((c) => [c.id, c]));

  const buyerRow = (b: BuyerStat): CustomerRow | null => {
    const c = byId.get(b.customerId);
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      document: c.document,
      orders: b.orders,
      totalSpent: b.totalSpent,
      avgTicket: round2(b.totalSpent / b.orders),
      lastDays: b.lastDays,
      segment: b.segment,
      dueRepurchase: b.dueRepurchase,
    };
  };
  const novoRow = (c: (typeof novos)[number]): CustomerRow => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    document: c.document,
    orders: 0,
    totalSpent: 0,
    avgTicket: 0,
    lastDays: null,
    segment: "novo",
    dueRepurchase: false,
  });

  const isRow = (r: CustomerRow | null): r is CustomerRow => r !== null;
  const customers = [...pageBuyers.map(buyerRow).filter(isRow), ...novos.map(novoRow)];
  const dueTop = dueTopStats.map(buyerRow).filter(isRow);

  return {
    customers,
    counts,
    total,
    ticketMedio,
    dueCount: due.length,
    dueTop,
    pageMeta: pageMeta(page, total),
  };
}
