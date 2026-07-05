import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { applyStockMovement } from "./stock-ledger";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ---------------------------------------------------------------------------
// Recebimento de materiais. Confere quantidade pedida × recebida (com
// divergências e qualidade), permite recebimento PARCIAL e — na mesma transação
// — dá entrada no estoque (com razão de movimentação StockMovement) e gera a
// conta a pagar no financeiro. Fecha o ciclo Compra → Estoque → Financeiro.
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const round2 = (n: number) => Math.round(n * 100) / 100;
const code = (id: string) => `PC-${id.slice(-6).toUpperCase()}`;

// Status de pedido que ainda aceitam recebimento.
const RECEIVABLE = new Set(["enviado", "confirmado", "parcial"]);

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

// ---- Pedidos disponíveis para receber ----
export interface ReceivableRow {
  id: string;
  code: string;
  supplier: string;
  status: string;
  itemsCount: number;
  receivedItems: number;
  total: number;
  expectedDate: string | null;
}

export interface ReceivingKpis {
  aReceber: number;
  parciais: number;
  recebidosMes: number;
}

export interface ReceivableListResult {
  rows: ReceivableRow[];
  meta: PageMeta;
  kpis: ReceivingKpis;
}

export async function listReceivableOrders(
  org: string,
  opts: { page?: number } = {},
): Promise<ReceivableListResult> {
  const where = {
    organizationId: org,
    status: { in: ["enviado", "confirmado", "parcial"] },
  };
  const total = await prisma.purchaseOrder.count({ where });
  const page = clampPage(opts.page, total);

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const [list, parciais, recebidosMes] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { supplier: { select: { name: true } }, items: true },
    }),
    prisma.purchaseOrder.count({
      where: { organizationId: org, status: "parcial" },
    }),
    prisma.purchaseOrder.count({
      where: {
        organizationId: org,
        status: "recebido",
        receivedAt: { gte: startMonth },
      },
    }),
  ]);

  return {
    rows: list.map((o) => ({
      id: o.id,
      code: code(o.id),
      supplier: o.supplier.name,
      status: o.status,
      itemsCount: o.items.length,
      receivedItems: o.items.filter((it) => it.receivedQty >= it.quantity).length,
      total: money(o.total),
      expectedDate: fmtDate(o.expectedDate),
    })),
    meta: pageMeta(page, total),
    kpis: {
      aReceber: total,
      parciais,
      recebidosMes,
    },
  };
}

// ---- Alvo do recebimento (conferência) ----
export interface ReceivingTarget {
  id: string;
  code: string;
  status: string;
  supplier: string;
  items: {
    id: string;
    name: string;
    productId: string | null;
    ordered: number;
    received: number;
    remaining: number;
    unitCost: number;
  }[];
}

export async function getReceivingTarget(
  org: string,
  orderId: string,
): Promise<ReceivingTarget | null> {
  const o = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { supplier: { select: { name: true } }, items: true },
  });
  if (!o || o.organizationId !== org) return null;
  return {
    id: o.id,
    code: code(o.id),
    status: o.status,
    supplier: o.supplier.name,
    items: o.items.map((it) => ({
      id: it.id,
      name: it.name,
      productId: it.productId,
      ordered: it.quantity,
      received: it.receivedQty,
      remaining: Math.max(0, it.quantity - it.receivedQty),
      unitCost: money(it.unitCost),
    })),
  };
}

export interface ReceiveLine {
  orderItemId: string;
  qtyReceived: number;
  qualityOk: boolean;
  note?: string;
}

/**
 * Registra o recebimento (parcial ou total). Em UMA transação: cria o
 * Recebimento + itens (com divergência/qualidade), atualiza receivedQty do
 * pedido, dá entrada no estoque dos itens APROVADOS (com StockMovement/ledger),
 * recalcula o status do pedido e gera a conta a pagar do valor recebido.
 */
export async function receiveOrder(
  org: string,
  orderId: string,
  lines: ReceiveLine[],
  receiver: { id: string; name: string },
  note: string,
): Promise<{
  ok: boolean;
  error?: string;
  status?: string;
  payable?: number;
  receiptId?: string;
}> {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { items: true, supplier: true },
  });
  if (!order || order.organizationId !== org)
    return { ok: false, error: "Pedido não encontrado." };
  if (!RECEIVABLE.has(order.status))
    return { ok: false, error: "Este pedido não está disponível para recebimento." };

  const itemById = new Map(order.items.map((it) => [it.id, it]));

  // Normaliza: clampa a quantidade recebida ao que ainda falta receber.
  const clean = (lines ?? [])
    .map((l) => {
      const it = itemById.get(l.orderItemId);
      if (!it) return null;
      const remaining = Math.max(0, it.quantity - it.receivedQty);
      const qty = Math.min(remaining, Math.max(0, Math.trunc(Number(l.qtyReceived) || 0)));
      return {
        item: it,
        qty,
        qualityOk: l.qualityOk !== false,
        note: str(l.note, 200),
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.qty > 0);

  if (clean.length === 0)
    return { ok: false, error: "Informe ao menos uma quantidade recebida." };

  const dueDays = order.supplier.paymentTermDays > 0 ? order.supplier.paymentTermDays : 28;

  const result = await prisma.$transaction(async (tx) => {
    const seq = await tx.receipt.count({ where: { organizationId: org } });
    const number = `RC-${String(seq + 1).padStart(5, "0")}`;

    const rejected = clean.filter((l) => !l.qualityOk).length;
    const receiptStatus =
      rejected === 0 ? "aprovado" : rejected === clean.length ? "rejeitado" : "parcial";

    const receipt = await tx.receipt.create({
      data: {
        organizationId: org,
        orderId,
        number,
        status: receiptStatus,
        receivedById: receiver.id,
        receivedByName: receiver.name,
        note: str(note, 300),
        items: {
          create: clean.map((l) => ({
            orderItemId: l.item.id,
            productId: l.item.productId,
            name: l.item.name,
            qtyOrdered: l.item.quantity,
            qtyReceived: l.qty,
            qualityOk: l.qualityOk,
            note: l.note,
          })),
        },
      },
    });

    let payable = 0;
    for (const l of clean) {
      // Atualiza o recebido do item SEMPRE (mesmo reprovado conta como conferido).
      await tx.purchaseOrderItem.update({
        where: { id: l.item.id },
        data: { receivedQty: { increment: l.qty } },
      });
      // Só entra no estoque + financeiro o que passou na qualidade.
      if (l.qualityOk) {
        payable += l.qty * money(l.item.unitCost);
        if (l.item.productId) {
          // Entrada no estoque pelo RAZÃO central (saldo anterior→posterior,
          // documento = recebimento, responsável).
          await applyStockMovement(tx, {
            organizationId: org,
            productId: l.item.productId,
            delta: l.qty,
            reason: "recebimento",
            refType: "receipt",
            refId: receipt.id,
            actor: { id: receiver.id, name: receiver.name },
            note: `${number} · ${code(orderId)}`,
          });
        }
      }
    }

    // Recalcula o status do pedido a partir das quantidades atualizadas.
    const fresh = await tx.purchaseOrderItem.findMany({ where: { orderId } });
    const allReceived = fresh.every((it) => it.receivedQty >= it.quantity);
    const anyReceived = fresh.some((it) => it.receivedQty > 0);
    const newStatus = allReceived ? "recebido" : anyReceived ? "parcial" : order.status;
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        receivedAt: allReceived ? new Date() : order.receivedAt,
      },
    });

    // Conta a pagar pelo valor efetivamente recebido (qualidade aprovada).
    payable = round2(payable);
    if (payable > 0) {
      const due = new Date(Date.now() + dueDays * 86400000);
      await tx.financialEntry.create({
        data: {
          organizationId: org,
          kind: "pagar",
          description: `Recebimento ${number} · ${order.supplier.name} (${code(orderId)})`,
          category: "Mercadorias",
          amount: payable,
          status: "pendente",
          dueDate: due,
        },
      });
    }

    return { receiptId: receipt.id, status: newStatus, payable };
  });

  return { ok: true, ...result };
}

// ---- Recebimentos já feitos de um pedido (histórico) ----
export async function getOrderReceipts(org: string, orderId: string) {
  const list = await prisma.receipt.findMany({
    where: { organizationId: org, orderId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return list.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    receivedBy: r.receivedByName,
    createdAt:
      r.createdAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) ?? "",
    items: r.items.map((it) => ({
      name: it.name,
      qtyReceived: it.qtyReceived,
      qtyOrdered: it.qtyOrdered,
      qualityOk: it.qualityOk,
    })),
  }));
}
