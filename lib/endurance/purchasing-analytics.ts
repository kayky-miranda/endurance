import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

// ---------------------------------------------------------------------------
// Painel executivo de Compras. Agrega os pedidos (não cancelados), as cotações
// (para a economia em negociação) e os fornecedores num conjunto de KPIs e
// séries para gráficos. Tudo escopado por organizationId.
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PurchasingAnalytics {
  kpis: {
    comprasMes: number;
    pedidosMes: number;
    pedidosAtraso: number;
    fornecedoresAtivos: number;
    economia: number;
    leadTimeMedio: number;
  };
  byMonth: { label: string; total: number }[];
  byCategory: { name: string; value: number }[];
  topSuppliers: { name: string; value: number; orders: number }[];
  leadBySupplier: { name: string; days: number }[];
  overdue: { code: string; supplier: string; expected: string; total: number }[];
}

const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export async function getPurchasingAnalytics(
  org: string,
  months = 6,
): Promise<PurchasingAnalytics> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [orders, products, activeSuppliers, closedQuotes] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { organizationId: org, status: { not: "cancelado" } },
      include: { supplier: { select: { name: true } }, items: true },
    }),
    prisma.product.findMany({
      where: { organizationId: org },
      select: { id: true, category: true },
    }),
    prisma.supplier.count({ where: { organizationId: org, status: "ativo" } }),
    prisma.quotation.findMany({
      where: { organizationId: org, status: "fechada", winnerSupplierId: { not: null } },
      include: { suppliers: { select: { supplierId: true, total: true } } },
    }),
  ]);

  const catById = new Map(products.map((p) => [p.id, p.category || "Sem categoria"]));

  // --- KPIs de período ---
  const comprasMes = round2(
    orders
      .filter((o) => o.createdAt >= startMonth)
      .reduce((a, o) => a + money(o.total), 0),
  );
  const pedidosMes = orders.filter((o) => o.createdAt >= startMonth).length;

  const overdueOrders = orders.filter(
    (o) =>
      ["aberto", "enviado", "confirmado", "parcial"].includes(o.status) &&
      o.expectedDate != null &&
      o.expectedDate < now,
  );

  // Economia em negociação: Σ (maior proposta − proposta vencedora) por cotação.
  let economia = 0;
  for (const q of closedQuotes) {
    const totals = q.suppliers.map((s) => money(s.total)).filter((t) => t > 0);
    if (totals.length < 2) continue;
    const max = Math.max(...totals);
    const winner = money(
      q.suppliers.find((s) => s.supplierId === q.winnerSupplierId)?.total ?? 0,
    );
    if (winner > 0 && max > winner) economia += max - winner;
  }
  economia = round2(economia);

  // Lead time médio real (pedidos recebidos): receivedAt − createdAt.
  const received = orders.filter((o) => o.status === "recebido" && o.receivedAt);
  const leadTimeMedio = received.length
    ? Math.round(
        received.reduce(
          (a, o) =>
            a + (o.receivedAt!.getTime() - o.createdAt.getTime()) / 86400000,
          0,
        ) / received.length,
      )
    : 0;

  // --- Séries ---
  // Compras por mês (janela de `months`).
  const byMonth: { label: string; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const total = orders
      .filter((o) => o.createdAt >= d && o.createdAt < next)
      .reduce((a, o) => a + money(o.total), 0);
    byMonth.push({
      label: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      total: round2(total),
    });
  }

  // Compras por categoria (na janela), via Product.category dos itens.
  const catMap = new Map<string, number>();
  for (const o of orders) {
    if (o.createdAt < windowStart) continue;
    for (const it of o.items) {
      const cat = it.productId ? catById.get(it.productId) ?? "Sem categoria" : "Sem categoria";
      catMap.set(cat, (catMap.get(cat) ?? 0) + it.quantity * money(it.unitCost));
    }
  }
  const byCategory = [...catMap.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Top fornecedores (por valor de compra, na janela).
  const supMap = new Map<string, { value: number; orders: number }>();
  for (const o of orders) {
    if (o.createdAt < windowStart) continue;
    const cur = supMap.get(o.supplier.name) ?? { value: 0, orders: 0 };
    cur.value += money(o.total);
    cur.orders += 1;
    supMap.set(o.supplier.name, cur);
  }
  const topSuppliers = [...supMap.entries()]
    .map(([name, v]) => ({ name, value: round2(v.value), orders: v.orders }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Lead time por fornecedor (média real dos recebidos).
  const leadMap = new Map<string, { days: number; n: number }>();
  for (const o of received) {
    const days = (o.receivedAt!.getTime() - o.createdAt.getTime()) / 86400000;
    const cur = leadMap.get(o.supplier.name) ?? { days: 0, n: 0 };
    cur.days += days;
    cur.n += 1;
    leadMap.set(o.supplier.name, cur);
  }
  const leadBySupplier = [...leadMap.entries()]
    .map(([name, v]) => ({ name, days: Math.round(v.days / v.n) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const overdue = overdueOrders
    .sort((a, b) => (a.expectedDate!.getTime() - b.expectedDate!.getTime()))
    .slice(0, 10)
    .map((o) => ({
      code: `PC-${o.id.slice(-6).toUpperCase()}`,
      supplier: o.supplier.name,
      expected: o.expectedDate!.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      total: money(o.total),
    }));

  return {
    kpis: {
      comprasMes,
      pedidosMes,
      pedidosAtraso: overdueOrders.length,
      fornecedoresAtivos: activeSuppliers,
      economia,
      leadTimeMedio,
    },
    byMonth,
    byCategory,
    topSuppliers,
    leadBySupplier,
    overdue,
  };
}
