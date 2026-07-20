import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { applyStockMovement } from "@/lib/endurance/stock-ledger";
import type { Prisma } from "@prisma/client";
import {
  COUNT_STATUS_LABEL,
  COUNT_TYPE_LABEL,
  canTransition,
  type CountType,
  type CountStatus,
} from "./stock-count-shared";

// Re-exporta a parte pura para os callers server que já importam daqui.
export {
  COUNT_STATUS_LABEL,
  COUNT_TYPE_LABEL,
  canTransition,
  type CountType,
  type CountStatus,
};

/**
 * Conferência / inventário de estoque.
 *
 * REGRA DE OURO: nenhum ajuste no saldo acontece durante a contagem. O estoque
 * só muda ao EFETIVAR uma conferência já APROVADA (adjustCount), e sempre pelo
 * razão (applyStockMovement, motivo "inventario"), preservando a auditoria.
 *
 * Máquina de estados:
 *   rascunho → em_conferencia → aguardando_aprovacao → aprovada → ajustada
 *   (cancelada a partir de qualquer estado não-ajustado)
 */

/** Número humano sequencial por org/ano: CONF-AAAA-NNNN. */
async function nextCountNumber(
  tx: Tx,
  org: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.stockCount.count({
    where: {
      organizationId: org,
      createdAt: { gte: new Date(year, 0, 1) },
    },
  });
  return `CONF-${year}-${String(count + 1).padStart(4, "0")}`;
}

export interface CreateCountInput {
  org: string;
  type: CountType;
  location?: string;
  responsibleId?: string | null;
  responsibleName?: string;
  note?: string;
  createdBy: { id: string; name: string };
  /** Carregar automaticamente os produtos (geral) ou por categoria. */
  autoLoad?: boolean;
  categoryFilter?: string;
}

export async function createCount(input: CreateCountInput): Promise<{
  ok: boolean;
  id?: string;
  number?: string;
  error?: string;
}> {
  return prisma.$transaction(async (tx) => {
    const number = await nextCountNumber(tx, input.org);
    const count = await tx.stockCount.create({
      data: {
        organizationId: input.org,
        number,
        type: input.type,
        location: input.location ?? "",
        responsibleId: input.responsibleId ?? null,
        responsibleName: input.responsibleName ?? "",
        note: input.note ?? "",
        createdById: input.createdBy.id,
        createdByName: input.createdBy.name,
        status: "rascunho",
      },
    });

    // Carregamento automático: puxa os produtos (todos ou por categoria) com o
    // saldo atual congelado como systemQty.
    if (input.autoLoad) {
      const products = await tx.product.findMany({
        where: {
          organizationId: input.org,
          ...(input.categoryFilter
            ? { category: input.categoryFilter }
            : {}),
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          sku: true,
          category: true,
          stock: true,
          cost: true,
        },
      });
      if (products.length) {
        await tx.stockCountItem.createMany({
          data: products.map((p) => ({
            stockCountId: count.id,
            productId: p.id,
            productName: p.name,
            barcode: p.barcode,
            sku: p.sku,
            category: p.category,
            systemQty: p.stock,
            unitCost: p.cost,
          })),
          skipDuplicates: true,
        });
      }
    }

    return { ok: true, id: count.id, number };
  });
}

/** Adiciona (ou reusa) um item na conferência, congelando o saldo do sistema. */
export async function addItem(
  org: string,
  countId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string; item?: ScannedItem }> {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (count.status !== "rascunho" && count.status !== "em_conferencia")
    return { ok: false, error: "A conferência não aceita novos itens neste status." };

  const p = await prisma.product.findFirst({
    where: { id: productId, organizationId: org },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      category: true,
      stock: true,
      cost: true,
    },
  });
  if (!p) return { ok: false, error: "Produto não encontrado." };

  const exists = await prisma.stockCountItem.findUnique({
    where: { stockCountId_productId: { stockCountId: countId, productId } },
  });
  if (exists) return { ok: true, item: toItemDTO(exists) }; // idempotente

  const created = await prisma.stockCountItem.create({
    data: {
      stockCountId: countId,
      productId: p.id,
      productName: p.name,
      barcode: p.barcode,
      sku: p.sku,
      category: p.category,
      systemQty: p.stock,
      unitCost: p.cost,
    },
  });
  return { ok: true, item: toItemDTO(created) };
}

/** Item devolvido ao cliente (scan/add) para atualização otimista da UI. */
export interface ScannedItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  sku: string;
  category: string;
  systemQty: number;
  countedQty: number | null;
  unitCost: number;
  divergence: number | null;
  note: string;
}

function toItemDTO(i: {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  sku: string;
  category: string;
  systemQty: number;
  countedQty: number | null;
  unitCost: unknown;
  note: string;
}): ScannedItem {
  const counted = i.countedQty;
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    barcode: i.barcode,
    sku: i.sku,
    category: i.category,
    systemQty: i.systemQty,
    countedQty: counted,
    unitCost: money(i.unitCost as number),
    divergence: counted == null ? null : counted - i.systemQty,
    note: i.note,
  };
}

/**
 * Leitura por scanner: localiza o produto pelo código de barras e INCREMENTA a
 * quantidade conferida em +1 (cria a linha se ainda não existe). Modo hands-free
 * — devolve o item atualizado para a UI refletir sem recarregar a página.
 */
export async function scanItem(
  org: string,
  countId: string,
  barcode: string,
): Promise<
  | { ok: true; item: ScannedItem; created: boolean }
  | { ok: false; error: string; notFound?: boolean }
> {
  const code = barcode.trim();
  if (!code) return { ok: false, error: "Código vazio." };

  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
    select: { status: true },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (count.status !== "rascunho" && count.status !== "em_conferencia")
    return { ok: false, error: "A conferência não aceita leitura neste status." };

  const p = await prisma.product.findFirst({
    where: { organizationId: org, barcode: code },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      category: true,
      stock: true,
      cost: true,
    },
  });
  if (!p)
    return {
      ok: false,
      notFound: true,
      error: `Produto não cadastrado para o código ${code}.`,
    };

  // Incremento ATÔMICO no banco: com vários operadores bipando a mesma
  // conferência, "ler e somar" em JS perderia leituras concorrentes. Aqui a
  // soma acontece no próprio UPDATE (increment) e a criação simultânea da
  // mesma linha cai no unique (P2002) e vira soma.
  const productId = p.id; // narrow estável para os closures abaixo
  const uniqueWhere = {
    stockCountId_productId: { stockCountId: countId, productId },
  };

  async function bump(): Promise<void> {
    // Linha ainda não contada (countedQty null) começa em 1 (NULL+1 seria NULL);
    // se outro operador já contou, o claim falha e soma +1 direto no banco.
    const claimed = await prisma.stockCountItem.updateMany({
      where: { stockCountId: countId, productId, countedQty: null },
      data: { countedQty: 1 },
    });
    if (claimed.count === 0)
      await prisma.stockCountItem.updateMany({
        where: { stockCountId: countId, productId },
        data: { countedQty: { increment: 1 } },
      });
  }

  let item = null;
  let created = false;
  const existing = await prisma.stockCountItem.findUnique({
    where: uniqueWhere,
    select: { id: true },
  });
  if (existing) {
    await bump();
  } else {
    try {
      item = await prisma.stockCountItem.create({
        data: {
          stockCountId: countId,
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          sku: p.sku,
          category: p.category,
          systemQty: p.stock,
          unitCost: p.cost,
          countedQty: 1,
        },
      });
      created = true;
    } catch (e) {
      // Corrida: outro operador criou a linha neste exato instante — soma.
      if ((e as { code?: string })?.code !== "P2002") throw e;
      await bump();
    }
  }
  if (!item) item = await prisma.stockCountItem.findUnique({ where: uniqueWhere });
  if (!item) return { ok: false, error: "Falha ao registrar a leitura." };

  if (count.status === "rascunho")
    await prisma.stockCount.update({
      where: { id: countId },
      data: { status: "em_conferencia" },
    });

  return { ok: true, created, item: toItemDTO(item) };
}

export async function removeItem(
  org: string,
  countId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (count.status !== "rascunho" && count.status !== "em_conferencia")
    return { ok: false, error: "Não é possível remover itens neste status." };
  await prisma.stockCountItem.deleteMany({
    where: { id: itemId, stockCountId: countId },
  });
  return { ok: true };
}

/** Informa a quantidade física contada (e observação) de um item. */
export async function setCounted(
  org: string,
  countId: string,
  itemId: string,
  countedQty: number | null,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (count.status !== "rascunho" && count.status !== "em_conferencia")
    return { ok: false, error: "A contagem só é editável em rascunho ou em conferência." };

  const qty =
    countedQty == null
      ? null
      : Math.max(0, Math.trunc(Number.isFinite(countedQty) ? countedQty : 0));

  const res = await prisma.stockCountItem.updateMany({
    where: { id: itemId, stockCountId: countId },
    data: { countedQty: qty, ...(note !== undefined ? { note } : {}) },
  });
  if (res.count === 0) return { ok: false, error: "Item não encontrado." };

  // Ao contar o primeiro item, sai de rascunho para "em conferência".
  if (count.status === "rascunho" && qty != null)
    await prisma.stockCount.update({
      where: { id: countId },
      data: { status: "em_conferencia" },
    });
  return { ok: true };
}

/** Muda o status validando a máquina de estados. Sem efeito colateral no estoque. */
export async function transition(
  org: string,
  countId: string,
  to: CountStatus,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; error?: string; from?: string }> {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (!canTransition(count.status, to))
    return {
      ok: false,
      error: `Transição inválida (${COUNT_STATUS_LABEL[count.status]} → ${COUNT_STATUS_LABEL[to]}).`,
    };

  const data: Prisma.StockCountUpdateInput = { status: to };
  if (to === "aguardando_aprovacao") data.finalizedAt = new Date();
  if (to === "aprovada") {
    data.approvedById = actor.id;
    data.approvedByName = actor.name;
    data.approvedAt = new Date();
  }

  await prisma.stockCount.update({ where: { id: countId }, data });
  return { ok: true, from: count.status };
}

/**
 * Efetiva a conferência APROVADA: aplica o ajuste no estoque para cada item
 * divergente, via razão (motivo "inventario"), dentro de UMA transação. O delta
 * usado é a DIVERGÊNCIA da contagem (contado − sistema no momento da contagem),
 * aplicada ao saldo atual — assim vendas concorrentes durante a contagem não são
 * perdidas. allowNegative garante que uma correção de perda nunca falhe.
 */
export async function adjustCount(
  org: string,
  countId: string,
  actor: { id: string; name: string },
): Promise<{ ok: boolean; error?: string; adjusted?: number }> {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
    include: { items: true },
  });
  if (!count) return { ok: false, error: "Conferência não encontrada." };
  if (count.status !== "aprovada")
    return { ok: false, error: "Só é possível ajustar uma conferência aprovada." };

  const divergent = count.items.filter(
    (i) => i.countedQty != null && i.countedQty !== i.systemQty,
  );

  await prisma.$transaction(async (tx) => {
    for (const it of divergent) {
      const delta = (it.countedQty as number) - it.systemQty;
      if (delta === 0) continue;
      await applyStockMovement(tx, {
        organizationId: org,
        productId: it.productId,
        delta,
        reason: "inventario",
        refType: "stock_count",
        refId: count.id,
        note: `Conferência ${count.number}${it.note ? ` — ${it.note}` : ""}`,
        actor,
        allowNegative: true,
      });
    }
    await tx.stockCount.update({
      where: { id: countId },
      data: { status: "ajustada", adjustedAt: new Date() },
    });
  });

  return { ok: true, adjusted: divergent.length };
}

// ---------------------------------------------------------------------------
// Consultas / analítico
// ---------------------------------------------------------------------------

export interface CountListFilters {
  status?: string;
  type?: string;
  responsibleId?: string;
  location?: string;
  from?: Date;
  to?: Date;
}

export async function listCounts(org: string, filters: CountListFilters = {}) {
  const where: Prisma.StockCountWhereInput = { organizationId: org };
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.responsibleId) where.responsibleId = filters.responsibleId;
  if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
  if (filters.from || filters.to)
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };

  const rows = await prisma.stockCount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      items: {
        select: { systemQty: true, countedQty: true, unitCost: true },
      },
    },
  });

  return rows.map((c) => {
    const counted = c.items.filter((i) => i.countedQty != null);
    const divergent = counted.filter((i) => i.countedQty !== i.systemQty);
    const divValue = divergent.reduce(
      (s, i) =>
        s + Math.abs((i.countedQty as number) - i.systemQty) * money(i.unitCost),
      0,
    );
    return {
      id: c.id,
      number: c.number,
      type: c.type,
      location: c.location,
      status: c.status,
      responsibleName: c.responsibleName,
      createdByName: c.createdByName,
      createdAt: c.createdAt.toISOString(),
      itemsTotal: c.items.length,
      countedTotal: counted.length,
      divergentTotal: divergent.length,
      divergenceValue: divValue,
    };
  });
}

/** Resumo operacional (dashboard) do módulo. */
export async function countDashboard(org: string, filters: CountListFilters = {}) {
  const list = await listCounts(org, filters);

  const inProgress = list.filter(
    (c) => c.status === "rascunho" || c.status === "em_conferencia",
  ).length;
  const awaiting = list.filter(
    (c) => c.status === "aguardando_aprovacao",
  ).length;

  // Acuracidade e divergências consideram conferências já contadas (todas as
  // que têm itens contados), evitando distorção por rascunhos vazios.
  const itemsCounted = list.reduce((s, c) => s + c.countedTotal, 0);
  const itemsDivergent = list.reduce((s, c) => s + c.divergentTotal, 0);
  const divergenceValue = list.reduce((s, c) => s + c.divergenceValue, 0);
  const accuracy =
    itemsCounted > 0
      ? ((itemsCounted - itemsDivergent) / itemsCounted) * 100
      : 100;

  return {
    inProgress,
    awaiting,
    itemsCounted,
    itemsDivergent,
    divergenceValue,
    accuracy,
    list,
  };
}

/** Carrega uma conferência com itens (para a tela de contagem). */
export async function getCount(org: string, countId: string) {
  const c = await prisma.stockCount.findFirst({
    where: { id: countId, organizationId: org },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    number: c.number,
    type: c.type,
    location: c.location,
    status: c.status,
    responsibleName: c.responsibleName,
    createdByName: c.createdByName,
    approvedByName: c.approvedByName,
    approvedAt: c.approvedAt?.toISOString() ?? null,
    adjustedAt: c.adjustedAt?.toISOString() ?? null,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    items: c.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      barcode: i.barcode,
      sku: i.sku,
      category: i.category,
      systemQty: i.systemQty,
      countedQty: i.countedQty,
      unitCost: money(i.unitCost),
      divergence: i.countedQty == null ? null : i.countedQty - i.systemQty,
      note: i.note,
    })),
  };
}

export type CountDetail = NonNullable<Awaited<ReturnType<typeof getCount>>>;
export type CountListRow = Awaited<ReturnType<typeof listCounts>>[number];
