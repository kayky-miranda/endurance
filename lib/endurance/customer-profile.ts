import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import type { Segment } from "./crm";
import { T } from "./sql";

/**
 * Ficha do cliente: tudo o que a loja sabe sobre uma pessoa em uma tela só —
 * identificação, resumo de compras, produtos preferidos, histórico de vendas
 * e o que ainda está em aberto no financeiro (fiado).
 *
 * Todas as agregações rodam no banco; o histórico vem paginado.
 */

const DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CustomerPurchase {
  id: string;
  code: string;
  date: string;
  itemsCount: number;
  total: number;
  payments: string;
  seller: string;
}

export interface CustomerFavorite {
  name: string;
  qty: number;
  revenue: number;
}

export interface CustomerOpenEntry {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  overdue: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  createdAt: string;
  // Resumo
  orders: number;
  totalSpent: number;
  avgTicket: number;
  firstPurchase: string | null;
  lastPurchase: string | null;
  lastDays: number | null;
  segment: Segment;
  // Detalhe
  favorites: CustomerFavorite[];
  purchases: CustomerPurchase[];
  purchasesTotal: number;
  openEntries: CustomerOpenEntry[];
  openTotal: number;
}

/** Mesma régua de segmentação do CRM, para a ficha não contar outra história. */
function segmentOf(orders: number, lastDays: number | null): Segment {
  if (orders === 0 || lastDays === null) return "novo";
  if (lastDays <= 30) return "ativo";
  if (lastDays <= 90) return "em_risco";
  return "inativo";
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function getCustomerProfile(
  org: string,
  customerId: string,
  opts: { historyLimit?: number } = {},
): Promise<CustomerProfile | null> {
  const limit = Math.min(100, Math.max(5, opts.historyLimit ?? 20));

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
  });
  if (!customer) return null;

  const [agg, bounds, purchases, favRows, openRows] = await Promise.all([
    prisma.sale.aggregate({
      where: { organizationId: org, customerId },
      _count: true,
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { organizationId: org, customerId },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.sale.findMany({
      where: { organizationId: org, customerId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        itemsCount: true,
        total: true,
        seller: { select: { name: true } },
        payments: { select: { method: true, amount: true } },
      },
    }),
    // Produtos preferidos: soma por nome de item das vendas deste cliente.
    prisma.saleItem.groupBy({
      by: ["name"],
      where: { sale: { organizationId: org, customerId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    // Em aberto (fiado): recebíveis pendentes das vendas deste cliente.
    // FinancialEntry guarda saleId sem relação declarada no Prisma, então o
    // join vai em SQL — qualificado pelo schema (ver lib/endurance/sql.ts).
    prisma.$queryRaw<
      { id: string; description: string; amount: number; dueDate: Date }[]
    >`
      SELECT f."id", f."description", f."amount"::float8 AS amount, f."dueDate"
      FROM ${T("FinancialEntry")} f
      JOIN ${T("Sale")} s ON s."id" = f."saleId"
      WHERE f."organizationId" = ${org}
        AND f."kind" = 'receber'
        AND f."status" = 'pendente'
        AND s."customerId" = ${customerId}
      ORDER BY f."dueDate" ASC`,
  ]);

  const orders = agg._count;
  const totalSpent = money(agg._sum.total ?? 0);
  const last = bounds._max.createdAt;
  const lastDays = last
    ? Math.floor((Date.now() - last.getTime()) / DAY)
    : null;

  // Receita por produto preferido: precisa do preço, então soma à parte.
  const favNames = favRows.map((f) => f.name);
  const favRevenue = favNames.length
    ? await prisma.saleItem.findMany({
        where: { sale: { organizationId: org, customerId }, name: { in: favNames } },
        select: { name: true, quantity: true, unitPrice: true },
      })
    : [];
  const revenueByName = new Map<string, number>();
  for (const r of favRevenue) {
    revenueByName.set(
      r.name,
      (revenueByName.get(r.name) ?? 0) + r.quantity * money(r.unitPrice),
    );
  }

  const now = new Date();
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.document,
    createdAt: fmtDate(customer.createdAt),
    orders,
    totalSpent: round2(totalSpent),
    avgTicket: round2(orders ? totalSpent / orders : 0),
    firstPurchase: bounds._min.createdAt ? fmtDate(bounds._min.createdAt) : null,
    lastPurchase: last ? fmtDate(last) : null,
    lastDays,
    segment: segmentOf(orders, lastDays),
    favorites: favRows.map((f) => ({
      name: f.name,
      qty: f._sum.quantity ?? 0,
      revenue: round2(revenueByName.get(f.name) ?? 0),
    })),
    purchases: purchases.map((s) => ({
      id: s.id,
      code: `#${s.id.slice(-6).toUpperCase()}`,
      date: s.createdAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      itemsCount: s.itemsCount,
      total: round2(money(s.total)),
      payments: s.payments.map((p) => p.method).join(" + ") || "—",
      seller: s.seller?.name ?? "—",
    })),
    purchasesTotal: orders,
    openEntries: openRows.map((e) => ({
      id: e.id,
      description: e.description,
      amount: round2(e.amount),
      dueDate: fmtDate(new Date(e.dueDate)),
      overdue: new Date(e.dueDate) < now,
    })),
    openTotal: round2(openRows.reduce((s, e) => s + e.amount, 0)),
  };
}
