import "server-only";
import { prisma } from "@/lib/db";
import { getReplenishment } from "./replenishment";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SupplierRow {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  orders: number;
}

export interface OrderItemRow {
  name: string;
  quantity: number;
  unitCost: number;
}

export interface OrderRow {
  id: string;
  code: string;
  supplier: string;
  status: "enviado" | "recebido" | "cancelado";
  total: number;
  itemsCount: number;
  createdAt: string;
  receivedAt: string | null;
  sentAt: string | null;
  items: OrderItemRow[];
}

export interface ProductPick {
  id: string;
  name: string;
  cost: number;
  stock: number;
}

export interface SuggestedItem {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface PurchasingOverview {
  suppliers: SupplierRow[];
  orders: OrderRow[];
  products: ProductPick[];
  suggestion: SuggestedItem[];
  kpis: {
    fornecedores: number;
    pedidosAbertos: number;
    valorAberto: number;
    recebidoMes: number;
  };
}

export async function getPurchasingOverview(
  org: string,
): Promise<PurchasingOverview> {
  const [suppliers, orders, products, replen] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.purchaseOrder.findMany({
      where: { organizationId: org },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { supplier: true, items: true },
    }),
    prisma.product.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true, stock: true },
    }),
    getReplenishment(org),
  ]);

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const orderRows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    code: `#${o.id.slice(-6).toUpperCase()}`,
    supplier: o.supplier.name,
    status: o.status as OrderRow["status"],
    total: o.total,
    itemsCount: o.items.length,
    createdAt: o.createdAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    receivedAt: o.receivedAt
      ? o.receivedAt.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })
      : null,
    sentAt: o.sentAt
      ? o.sentAt.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })
      : null,
    items: o.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitCost: it.unitCost,
    })),
  }));

  const pedidosAbertos = orders.filter((o) => o.status === "enviado");
  const recebidoMes = orders
    .filter((o) => o.status === "recebido" && o.receivedAt && o.receivedAt >= startMonth)
    .reduce((a, o) => a + o.total, 0);

  return {
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj,
      phone: s.phone,
      email: s.email,
      orders: s._count.orders,
    })),
    orders: orderRows,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      cost: p.cost,
      stock: p.stock,
    })),
    suggestion: replen.items.map((i) => ({
      productId: i.id,
      name: i.name,
      quantity: i.suggestedQty,
      unitCost: i.suggestedQty > 0 ? round2(i.estCost / i.suggestedQty) : 0,
    })),
    kpis: {
      fornecedores: suppliers.length,
      pedidosAbertos: pedidosAbertos.length,
      valorAberto: round2(pedidosAbertos.reduce((a, o) => a + o.total, 0)),
      recebidoMes: round2(recebidoMes),
    },
  };
}

export interface OrderDetail {
  id: string;
  code: string;
  status: string;
  total: number;
  note: string;
  createdAt: string;
  sentAt: string | null;
  supplier: { name: string; cnpj: string; phone: string; email: string };
  org: { name: string; city: string; state: string };
  items: OrderItemRow[];
}

export async function getPurchaseOrderDetail(
  org: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const o = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { supplier: true, items: true, organization: true },
  });
  if (!o || o.organizationId !== org) return null;
  return {
    id: o.id,
    code: `#${o.id.slice(-6).toUpperCase()}`,
    status: o.status,
    total: o.total,
    note: o.note,
    createdAt: o.createdAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    sentAt: o.sentAt
      ? o.sentAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    supplier: {
      name: o.supplier.name,
      cnpj: o.supplier.cnpj,
      phone: o.supplier.phone,
      email: o.supplier.email,
    },
    org: {
      name: o.organization.name,
      city: o.organization.city,
      state: o.organization.state,
    },
    items: o.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unitCost: it.unitCost,
    })),
  };
}

export async function markOrderSent(
  org: string,
  orderId: string,
  via: string,
): Promise<{ ok: boolean; error?: string }> {
  const o = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!o || o.organizationId !== org)
    return { ok: false, error: "Pedido não encontrado." };
  await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: {
      sentAt: new Date(),
      sentVia: ["whatsapp", "email"].includes(via) ? via : "manual",
    },
  });
  return { ok: true };
}

export async function createSupplier(
  org: string,
  input: { name: string; cnpj?: string; phone?: string; email?: string },
): Promise<{ ok: boolean; error?: string }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do fornecedor." };
  await prisma.supplier.create({
    data: {
      organizationId: org,
      name: name.slice(0, 120),
      cnpj: (input.cnpj ?? "").replace(/\D/g, "").slice(0, 14),
      phone: (input.phone ?? "").trim().slice(0, 30),
      email: (input.email ?? "").trim().slice(0, 120),
    },
  });
  return { ok: true };
}

export interface POItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
  unitCost: number;
}

export async function createPurchaseOrder(
  org: string,
  supplierId: string,
  items: POItemInput[],
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.organizationId !== org)
    return { ok: false, error: "Fornecedor inválido." };

  const clean = (items ?? [])
    .map((i) => ({
      productId: i.productId || null,
      name: (i.name ?? "").trim(),
      quantity: Math.max(0, Math.trunc(Number(i.quantity) || 0)),
      unitCost: round2(Number(i.unitCost) || 0),
    }))
    .filter((i) => i.name && i.quantity > 0);
  if (clean.length === 0)
    return { ok: false, error: "Adicione ao menos um item ao pedido." };

  const total = round2(clean.reduce((a, i) => a + i.quantity * i.unitCost, 0));
  await prisma.purchaseOrder.create({
    data: {
      organizationId: org,
      supplierId,
      status: "enviado",
      total,
      note: (note ?? "").trim().slice(0, 200),
      items: { create: clean },
    },
  });
  return { ok: true };
}

/**
 * Recebe um pedido: dá entrada no estoque dos itens com produto vinculado e gera
 * uma conta a pagar (vencimento +28 dias). Tudo em uma transação.
 */
export async function receivePurchaseOrder(
  org: string,
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { items: true, supplier: true },
  });
  if (!order || order.organizationId !== org)
    return { ok: false, error: "Pedido não encontrado." };
  if (order.status !== "enviado")
    return { ok: false, error: "Pedido já recebido ou cancelado." };

  const due = new Date();
  due.setDate(due.getDate() + 28);

  await prisma.$transaction([
    ...order.items
      .filter((it) => it.productId)
      .map((it) =>
        prisma.product.update({
          where: { id: it.productId! },
          data: { stock: { increment: it.quantity } },
        }),
      ),
    prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "recebido", receivedAt: new Date() },
    }),
    prisma.financialEntry.create({
      data: {
        organizationId: org,
        kind: "pagar",
        description: `Pedido #${orderId.slice(-6).toUpperCase()} · ${order.supplier.name}`,
        category: "Mercadorias",
        amount: order.total,
        status: "pendente",
        dueDate: due,
      },
    }),
  ]);
  return { ok: true };
}
