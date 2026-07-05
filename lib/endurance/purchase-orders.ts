import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { PO_STATUSES, poIsOpen, type PoStatus } from "./purchase-order-status";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ---------------------------------------------------------------------------
// Serviço de Pedidos de Compra. Gera o pedido a partir da cotação vencedora e
// controla o ciclo de status (aberto → enviado → confirmado → recebido). O
// recebimento de materiais (entrada de estoque + financeiro) fica no módulo
// "Recebimento". Tudo escopado por organizationId.
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

// ---- Cotações vencedoras ainda sem pedido (para gerar) ----
export async function listOrderableQuotations(org: string) {
  const quotes = await prisma.quotation.findMany({
    where: {
      organizationId: org,
      status: "fechada",
      winnerSupplierId: { not: null },
      orders: { none: {} }, // ainda não gerou pedido
    },
    orderBy: { createdAt: "desc" },
    include: {
      suppliers: { include: { supplier: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
  });
  return quotes.map((q) => {
    const winner = q.suppliers.find((s) => s.supplierId === q.winnerSupplierId);
    return {
      id: q.id,
      number: q.number,
      supplier: winner?.supplier.name ?? "",
      total: money(winner?.total ?? 0),
      itemsCount: q._count.items,
    };
  });
}

/**
 * Gera o pedido de compra a partir da cotação vencedora (fechada). Copia os
 * itens com o preço do vencedor. Idempotente: se já houver pedido para a
 * cotação, devolve o existente.
 */
export async function generateFromQuotation(
  org: string,
  quotationId: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: true,
      suppliers: { include: { prices: true } },
      orders: { select: { id: true } },
    },
  });
  if (!q || q.organizationId !== org)
    return { ok: false, error: "Cotação não encontrada." };
  if (q.status !== "fechada" || !q.winnerSupplierId)
    return { ok: false, error: "A cotação precisa estar fechada com um vencedor." };
  if (q.orders.length > 0) return { ok: true, id: q.orders[0].id };

  const winner = q.suppliers.find((s) => s.supplierId === q.winnerSupplierId);
  if (!winner) return { ok: false, error: "Fornecedor vencedor inválido." };

  const priceByItem = new Map(
    winner.prices.map((p) => [p.quotationItemId, money(p.unitPrice)]),
  );
  const items = q.items.map((it) => ({
    productId: it.productId,
    name: it.name,
    quantity: it.quantity,
    unitCost: priceByItem.get(it.id) ?? 0,
  }));
  const total = round2(
    items.reduce((a, it) => a + it.quantity * it.unitCost, 0),
  );

  const expected = winner.leadTimeDays
    ? new Date(Date.now() + winner.leadTimeDays * 86400000)
    : null;

  const created = await prisma.purchaseOrder.create({
    data: {
      organizationId: org,
      supplierId: q.winnerSupplierId,
      quotationId: q.id,
      requisitionId: q.requisitionId,
      status: "aberto",
      total,
      paymentTerm: winner.paymentTerm,
      expectedDate: expected,
      items: { create: items },
    },
  });
  return { ok: true, id: created.id };
}

// ---- Listagem ----
export interface PoRow {
  id: string;
  code: string;
  supplier: string;
  status: string;
  total: number;
  itemsCount: number;
  createdAt: string;
  expectedDate: string | null;
}

export interface PoKpis {
  abertos: number;
  emAndamento: number;
  recebidos: number;
  valorAberto: number;
}

export interface PoListResult {
  rows: PoRow[];
  meta: PageMeta;
  kpis: PoKpis;
}

const code = (id: string) => `PC-${id.slice(-6).toUpperCase()}`;

export async function listPurchaseOrders(
  org: string,
  opts: { status?: string; page?: number } = {},
): Promise<PoListResult> {
  const status = PO_STATUSES.includes(opts.status as PoStatus) ? opts.status : "";
  const where = { organizationId: org, ...(status ? { status } : {}) };
  const total = await prisma.purchaseOrder.count({ where });
  const page = clampPage(opts.page, total);

  const [list, all] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { organizationId: org },
      select: { status: true, total: true },
    }),
  ]);

  return {
    rows: list.map((o) => ({
      id: o.id,
      code: code(o.id),
      supplier: o.supplier.name,
      status: o.status,
      total: money(o.total),
      itemsCount: o._count.items,
      createdAt: fmtDate(o.createdAt) ?? "",
      expectedDate: fmtDate(o.expectedDate),
    })),
    meta: pageMeta(page, total),
    kpis: {
      abertos: all.filter((o) => o.status === "aberto").length,
      emAndamento: all.filter(
        (o) => o.status === "enviado" || o.status === "confirmado" || o.status === "parcial",
      ).length,
      recebidos: all.filter((o) => o.status === "recebido").length,
      valorAberto: round2(
        all
          .filter((o) => poIsOpen(o.status))
          .reduce((a, o) => a + money(o.total), 0),
      ),
    },
  };
}

export interface PoDetail {
  id: string;
  code: string;
  status: string;
  total: number;
  paymentTerm: string;
  note: string;
  createdAt: string;
  expectedDate: string | null;
  sentAt: string | null;
  sentVia: string;
  confirmedAt: string | null;
  supplier: { name: string; cnpj: string; phone: string; email: string };
  items: {
    id: string;
    name: string;
    quantity: number;
    receivedQty: number;
    unitCost: number;
  }[];
}

export async function getOrderDetail(
  org: string,
  id: string,
): Promise<PoDetail | null> {
  const o = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: true },
  });
  if (!o || o.organizationId !== org) return null;
  return {
    id: o.id,
    code: code(o.id),
    status: o.status,
    total: money(o.total),
    paymentTerm: o.paymentTerm,
    note: o.note,
    createdAt: fmtDate(o.createdAt) ?? "",
    expectedDate: fmtDate(o.expectedDate),
    sentAt: fmtDate(o.sentAt),
    sentVia: o.sentVia,
    confirmedAt: fmtDate(o.confirmedAt),
    supplier: {
      name: o.supplier.name,
      cnpj: o.supplier.cnpj,
      phone: o.supplier.phone,
      email: o.supplier.email,
    },
    items: o.items.map((it) => ({
      id: it.id,
      name: it.name,
      quantity: it.quantity,
      receivedQty: it.receivedQty,
      unitCost: money(it.unitCost),
    })),
  };
}

async function loadOrder(org: string, id: string) {
  const o = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!o || o.organizationId !== org) return null;
  return o;
}

export async function sendOrder(
  org: string,
  id: string,
  via: string,
): Promise<{ ok: boolean; error?: string }> {
  const o = await loadOrder(org, id);
  if (!o) return { ok: false, error: "Pedido não encontrado." };
  if (o.status !== "aberto" && o.status !== "enviado")
    return { ok: false, error: "Este pedido não pode mais ser enviado." };
  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "enviado",
      sentAt: new Date(),
      sentVia: ["whatsapp", "email"].includes(via) ? via : "manual",
    },
  });
  return { ok: true };
}

export async function confirmOrder(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const o = await loadOrder(org, id);
  if (!o) return { ok: false, error: "Pedido não encontrado." };
  if (o.status !== "aberto" && o.status !== "enviado")
    return { ok: false, error: "Só pedidos abertos ou enviados podem ser confirmados." };
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "confirmado", confirmedAt: new Date() },
  });
  return { ok: true };
}

export async function cancelOrder(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const o = await loadOrder(org, id);
  if (!o) return { ok: false, error: "Pedido não encontrado." };
  if (!poIsOpen(o.status))
    return { ok: false, error: "Pedido já recebido ou cancelado." };
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "cancelado" },
  });
  return { ok: true };
}
