import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ===========================================================================
// RAZÃO DE ESTOQUE (ledger) — ponto ÚNICO por onde passa TODA alteração de
// saldo de produto. Atualiza o estoque e grava a movimentação na MESMA operação,
// com saldo anterior/posterior, motivo, documento de origem e responsável.
// Garante rastreabilidade total e auditoria completa.
// ===========================================================================

/** Erro de saldo insuficiente numa saída (aborta a transação do chamador). */
export class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Estoque insuficiente de "${productName}".`);
    this.name = "InsufficientStockError";
  }
}

// Catálogo de MOTIVOS de movimentação. `dir`: in (entrada) | out (saída) |
// both (definido pelo sinal). `manual`: aparece no lançamento manual da UI.
export interface StockReasonDef {
  id: string;
  label: string;
  dir: "in" | "out" | "both";
  manual: boolean;
}

export const STOCK_REASONS: StockReasonDef[] = [
  // Automáticos (gerados pelo sistema)
  { id: "saldo_inicial", label: "Saldo inicial", dir: "in", manual: false },
  { id: "venda", label: "Venda (PDV)", dir: "out", manual: false },
  { id: "cancelamento_venda", label: "Cancelamento de venda", dir: "in", manual: false },
  { id: "recebimento", label: "Recebimento de compra", dir: "in", manual: false },
  { id: "importacao", label: "Importação em massa", dir: "both", manual: false },
  // Manuais (lançados pelo operador)
  { id: "ajuste_entrada", label: "Ajuste (entrada)", dir: "in", manual: true },
  { id: "ajuste_saida", label: "Ajuste (saída)", dir: "out", manual: true },
  { id: "devolucao_cliente", label: "Devolução de cliente", dir: "in", manual: true },
  { id: "devolucao_fornecedor", label: "Devolução ao fornecedor", dir: "out", manual: true },
  { id: "perda", label: "Perda", dir: "out", manual: true },
  { id: "avaria", label: "Avaria", dir: "out", manual: true },
  { id: "consumo_interno", label: "Consumo interno", dir: "out", manual: true },
  { id: "producao", label: "Produção (entrada)", dir: "in", manual: true },
  { id: "consumo_materia_prima", label: "Consumo de matéria-prima", dir: "out", manual: true },
  { id: "transferencia", label: "Transferência entre depósitos", dir: "both", manual: false },
];

const REASON_BY_ID = new Map(STOCK_REASONS.map((r) => [r.id, r]));
export function stockReasonLabel(id: string): string {
  return REASON_BY_ID.get(id)?.label ?? id;
}
export function manualReasons(): StockReasonDef[] {
  return STOCK_REASONS.filter((r) => r.manual);
}

export interface MovementActor {
  id?: string | null;
  name?: string;
}

export interface ApplyMovementInput {
  organizationId: string;
  productId: string;
  /** Quantidade COM SINAL: +entrada / −saída. */
  delta: number;
  reason: string;
  refType?: string; // sale | receipt | adjust | manual | import | initial | ...
  refId?: string;
  note?: string;
  actor?: MovementActor;
  /** Permite saldo negativo (ex.: importação que define saldo absoluto). */
  allowNegative?: boolean;
}

/**
 * Aplica UM movimento de estoque dentro de uma transação do chamador (`tx`).
 * Atualiza o saldo de forma atômica (incremento/decremento condicional, à prova
 * de corrida) e grava o registro no razão com saldo anterior e posterior.
 *
 * Saídas (delta < 0) usam baixa CONDICIONAL: se não houver saldo, lança
 * InsufficientStockError e a transação inteira do chamador é revertida.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: ApplyMovementInput,
): Promise<{ before: number; after: number }> {
  const { organizationId, productId, delta } = input;
  const reasonDef = REASON_BY_ID.get(input.reason);
  const allowNegative = input.allowNegative ?? false;

  if (delta < 0 && !allowNegative) {
    const need = -delta;
    const res = await tx.product.updateMany({
      where: { id: productId, organizationId, stock: { gte: need } },
      data: { stock: { decrement: need } },
    });
    if (res.count === 0) {
      const p = await tx.product.findUnique({
        where: { id: productId },
        select: { name: true },
      });
      throw new InsufficientStockError(p?.name ?? "produto");
    }
  } else {
    const res = await tx.product.updateMany({
      where: { id: productId, organizationId },
      data: { stock: { increment: delta } },
    });
    if (res.count === 0) throw new Error("Produto não encontrado no espaço.");
  }

  // Saldo após o movimento (a alteração foi atômica) → saldo antes = after − delta.
  const fresh = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });
  const after = fresh?.stock ?? 0;
  const before = after - delta;

  const type =
    reasonDef?.dir === "in" || delta > 0
      ? "entrada"
      : reasonDef?.dir === "out" || delta < 0
        ? "saida"
        : "ajuste";

  await tx.stockMovement.create({
    data: {
      organizationId,
      productId,
      type: delta === 0 ? "ajuste" : type,
      reason: input.reason,
      quantity: delta,
      balanceBefore: before,
      balanceAfter: after,
      refType: input.refType ?? "",
      refId: input.refId ?? "",
      userId: input.actor?.id ?? null,
      userName: input.actor?.name ?? "",
      note: input.note ?? "",
    },
  });

  return { before, after };
}

/**
 * Lançamento manual de movimentação (devolução, perda, avaria, consumo,
 * ajuste, produção…). Resolve a direção pelo motivo e roda em transação própria.
 */
export async function recordManualMovement(
  org: string,
  input: {
    productId: string;
    reason: string;
    quantity: number;
    note?: string;
    actor: MovementActor;
  },
): Promise<{ ok: boolean; error?: string; before?: number; after?: number }> {
  const def = REASON_BY_ID.get(input.reason);
  if (!def || !def.manual)
    return { ok: false, error: "Motivo de movimentação inválido." };
  const qty = Math.trunc(Number(input.quantity) || 0);
  if (qty <= 0) return { ok: false, error: "Informe uma quantidade maior que zero." };

  const prod = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!prod || prod.organizationId !== org)
    return { ok: false, error: "Produto não encontrado." };

  const delta = def.dir === "out" ? -qty : qty;
  try {
    const r = await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        organizationId: org,
        productId: input.productId,
        delta,
        reason: input.reason,
        refType: "manual",
        note: input.note,
        actor: input.actor,
      }),
    );
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof InsufficientStockError) return { ok: false, error: e.message };
    throw e;
  }
}

// ---- Visualização do razão (auditoria) ----
export interface StockMovementRow {
  id: string;
  createdAt: string;
  product: string;
  type: string;
  reason: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  document: string;
  user: string;
  note: string;
}

export interface StockMovementKpis {
  entradas: number;
  saidas: number;
  total: number;
}

export interface StockLedgerResult {
  rows: StockMovementRow[];
  meta: PageMeta;
  kpis: StockMovementKpis;
}

const DOC_LABEL: Record<string, string> = {
  sale: "Venda",
  receipt: "Recebimento",
  manual: "Manual",
  adjust: "Ajuste",
  import: "Importação",
  initial: "Cadastro",
};

export async function listStockMovements(
  org: string,
  opts: { productId?: string; type?: string; reason?: string; page?: number } = {},
): Promise<StockLedgerResult> {
  const type = ["entrada", "saida", "ajuste"].includes(String(opts.type))
    ? opts.type
    : "";
  const where = {
    organizationId: org,
    ...(opts.productId ? { productId: opts.productId } : {}),
    ...(type ? { type } : {}),
    ...(opts.reason && REASON_BY_ID.has(opts.reason) ? { reason: opts.reason } : {}),
  };

  const total = await prisma.stockMovement.count({ where });
  const page = clampPage(opts.page, total);

  const [list, allTypes] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { name: true } } },
    }),
    prisma.stockMovement.groupBy({
      by: ["type"],
      where: { organizationId: org },
      _count: { _all: true },
    }),
  ]);

  const countOf = (t: string) =>
    allTypes.find((g) => g.type === t)?._count._all ?? 0;

  return {
    rows: list.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      product: m.product.name,
      type: m.type,
      reason: stockReasonLabel(m.reason),
      quantity: m.quantity,
      balanceBefore: m.balanceBefore,
      balanceAfter: m.balanceAfter,
      document: m.refId
        ? `${DOC_LABEL[m.refType] ?? m.refType} ${m.refType === "sale" || m.refType === "receipt" ? "#" + m.refId.slice(-6).toUpperCase() : ""}`.trim()
        : DOC_LABEL[m.refType] ?? "—",
      user: m.userName || "Sistema",
      note: m.note,
    })),
    meta: pageMeta(page, total),
    kpis: {
      entradas: countOf("entrada"),
      saidas: countOf("saida"),
      total: allTypes.reduce((a, g) => a + g._count._all, 0),
    },
  };
}

/** Lista de produtos para o seletor do lançamento manual / filtro. */
export async function productsForPicker(org: string) {
  const list = await prisma.product.findMany({
    where: { organizationId: org },
    orderBy: { name: "asc" },
    select: { id: true, name: true, stock: true },
  });
  return list.map((p) => ({ id: p.id, name: p.name, stock: p.stock }));
}
