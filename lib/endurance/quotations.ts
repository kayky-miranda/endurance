import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { QUOTATION_STATUSES, type QuotationStatus } from "./quotation-status";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ---------------------------------------------------------------------------
// Serviço de Cotações. Fluxo: cria a partir de uma solicitação aprovada (ou
// itens avulsos) → envia a N fornecedores → registra preços/prazos → comparativo
// com ranking (menor preço / menor prazo / melhor avaliação) → escolhe vencedor.
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0));
const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// ---- Listagem ----
export interface QuotationRow {
  id: string;
  number: string;
  status: string;
  suppliers: number;
  items: number;
  winner: string;
  createdAt: string;
}

export interface QuotationKpis {
  abertas: number;
  fechadas: number;
  total: number;
}

export interface QuotationListResult {
  rows: QuotationRow[];
  meta: PageMeta;
  kpis: QuotationKpis;
}

export async function listQuotations(
  org: string,
  opts: { status?: string; page?: number } = {},
): Promise<QuotationListResult> {
  const status = QUOTATION_STATUSES.includes(opts.status as QuotationStatus)
    ? opts.status
    : "";
  const where = { organizationId: org, ...(status ? { status } : {}) };
  const total = await prisma.quotation.count({ where });
  const page = clampPage(opts.page, total);

  const [list, all] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { suppliers: true, items: true } },
        suppliers: {
          where: {},
          include: { supplier: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.quotation.findMany({
      where: { organizationId: org },
      select: { status: true },
    }),
  ]);

  return {
    rows: list.map((q) => ({
      id: q.id,
      number: q.number,
      status: q.status,
      suppliers: q._count.suppliers,
      items: q._count.items,
      winner:
        q.suppliers.find((s) => s.supplierId === q.winnerSupplierId)?.supplier
          .name ?? "",
      createdAt: fmtDate(q.createdAt),
    })),
    meta: pageMeta(page, total),
    kpis: {
      abertas: all.filter((q) => q.status === "aberta" || q.status === "respondida")
        .length,
      fechadas: all.filter((q) => q.status === "fechada").length,
      total: all.length,
    },
  };
}

// ---- Pickers para criar cotação ----
export async function listApprovedRequisitions(org: string) {
  const list = await prisma.purchaseRequisition.findMany({
    where: { organizationId: org, status: "aprovada" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return list.map((r) => ({
    id: r.id,
    number: r.number,
    itemsCount: r._count.items,
    estimatedTotal: money(r.estimatedTotal),
  }));
}

export async function listActiveSuppliers(org: string) {
  const list = await prisma.supplier.findMany({
    where: { organizationId: org, status: "ativo" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rating: true, leadTimeDays: true },
  });
  return list.map((s) => ({
    id: s.id,
    name: s.name,
    rating: s.rating,
    leadTimeDays: s.leadTimeDays,
  }));
}

async function nextNumber(org: string): Promise<string> {
  const count = await prisma.quotation.count({ where: { organizationId: org } });
  return `COT-${String(count + 1).padStart(5, "0")}`;
}

export interface QuotationItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
}

export async function createQuotation(
  org: string,
  input: {
    requisitionId?: string | null;
    supplierIds: string[];
    items?: QuotationItemInput[];
    note?: string;
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Itens: vêm da solicitação aprovada OU de itens avulsos informados.
  let items: QuotationItemInput[] = [];
  let requisitionId: string | null = null;

  if (input.requisitionId) {
    const req = await prisma.purchaseRequisition.findUnique({
      where: { id: input.requisitionId },
      include: { items: true },
    });
    if (!req || req.organizationId !== org)
      return { ok: false, error: "Solicitação inválida." };
    if (req.status !== "aprovada")
      return { ok: false, error: "Só solicitações aprovadas geram cotação." };

    // Uma solicitação, uma cotação viva.
    //
    // Sem esta trava a mesma solicitação aprovada podia virar duas cotações:
    // as duas ficavam abertas, as duas podiam ser fechadas com vencedor, e
    // cada uma gerava um pedido de compra. A empresa comprava em dobro, e
    // nada na tela indicava o problema — a solicitação continuava na lista de
    // "aprovadas aguardando cotação" depois de já ter uma.
    const emAndamento = await prisma.quotation.findFirst({
      where: { requisitionId: req.id, status: { not: "cancelada" } },
      select: { number: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (emAndamento)
      return {
        ok: false,
        error: `A solicitação ${req.number} já está na cotação ${emAndamento.number}. Cancele essa cotação antes de abrir outra.`,
      };

    requisitionId = req.id;
    items = req.items.map((it) => ({
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
    }));
  } else {
    items = (input.items ?? [])
      .map((i) => ({
        productId: i.productId || null,
        name: str(i.name, 160),
        quantity: int(i.quantity),
      }))
      .filter((i) => i.name && i.quantity > 0);
  }
  if (items.length === 0)
    return { ok: false, error: "A cotação precisa de ao menos um item." };

  // Fornecedores convidados (valida que são do mesmo org).
  const supplierIds = Array.from(new Set(input.supplierIds ?? []));
  if (supplierIds.length === 0)
    return { ok: false, error: "Selecione ao menos um fornecedor." };
  const valid = await prisma.supplier.findMany({
    where: { id: { in: supplierIds }, organizationId: org },
    select: { id: true },
  });
  if (valid.length === 0)
    return { ok: false, error: "Fornecedores inválidos." };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.quotation.create({
        data: {
          organizationId: org,
          number: await nextNumber(org),
          requisitionId,
          status: "aberta",
          note: str(input.note, 300),
          items: { create: items },
          suppliers: { create: valid.map((s) => ({ supplierId: s.id })) },
        },
      });
      return { ok: true, id: created.id };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  return { ok: false, error: "Não foi possível gerar o número da cotação." };
}

// ---- Detalhe + comparativo ----
export interface QuotationDetail {
  id: string;
  number: string;
  status: string;
  note: string;
  createdAt: string;
  winnerSupplierId: string | null;
  items: { id: string; name: string; quantity: number }[];
  suppliers: {
    id: string; // QuotationSupplier id
    supplierId: string;
    name: string;
    rating: number;
    paymentTerm: string;
    leadTimeDays: number;
    total: number;
    respondedAt: string | null;
    prices: Record<string, number>; // quotationItemId -> unitPrice
    isWinner: boolean;
    bestPrice: boolean;
    bestLead: boolean;
    bestRating: boolean;
  }[];
}

export async function getQuotationDetail(
  org: string,
  id: string,
): Promise<QuotationDetail | null> {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: true,
      suppliers: {
        include: { supplier: true, prices: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!q || q.organizationId !== org) return null;

  // Ranking: menor total (>0), menor lead time (>0), maior avaliação.
  const responded = q.suppliers.filter((s) => Number(s.total) > 0);
  const minTotal = responded.length
    ? Math.min(...responded.map((s) => money(s.total)))
    : -1;
  const leadCandidates = q.suppliers.filter((s) => s.leadTimeDays > 0);
  const minLead = leadCandidates.length
    ? Math.min(...leadCandidates.map((s) => s.leadTimeDays))
    : -1;
  const maxRating = q.suppliers.length
    ? Math.max(...q.suppliers.map((s) => s.supplier.rating))
    : -1;

  return {
    id: q.id,
    number: q.number,
    status: q.status,
    note: q.note,
    createdAt: fmtDate(q.createdAt),
    winnerSupplierId: q.winnerSupplierId,
    items: q.items.map((it) => ({
      id: it.id,
      name: it.name,
      quantity: it.quantity,
    })),
    suppliers: q.suppliers.map((s) => {
      const prices: Record<string, number> = {};
      for (const p of s.prices) prices[p.quotationItemId] = money(p.unitPrice);
      const total = money(s.total);
      return {
        id: s.id,
        supplierId: s.supplierId,
        name: s.supplier.name,
        rating: s.supplier.rating,
        paymentTerm: s.paymentTerm,
        leadTimeDays: s.leadTimeDays,
        total,
        respondedAt: s.respondedAt ? fmtDate(s.respondedAt) : null,
        prices,
        isWinner: q.winnerSupplierId === s.supplierId,
        bestPrice: minTotal > 0 && total === minTotal,
        bestLead: minLead > 0 && s.leadTimeDays === minLead,
        bestRating: maxRating > 0 && s.supplier.rating === maxRating,
      };
    }),
  };
}

/** Salva a proposta de um fornecedor (preços por item + prazo/pagamento). */
export async function saveSupplierBid(
  org: string,
  quotationSupplierId: string,
  input: {
    paymentTerm?: string;
    leadTimeDays?: number;
    prices: { quotationItemId: string; unitPrice: number }[];
  },
): Promise<{ ok: boolean; error?: string }> {
  const qs = await prisma.quotationSupplier.findUnique({
    where: { id: quotationSupplierId },
    include: {
      quotation: { select: { organizationId: true, status: true } },
      prices: true,
    },
  });
  if (!qs || qs.quotation.organizationId !== org)
    return { ok: false, error: "Proposta não encontrada." };
  if (qs.quotation.status === "fechada" || qs.quotation.status === "cancelada")
    return { ok: false, error: "Cotação encerrada." };

  // Quantidades dos itens (para o total = Σ qty × preço).
  const items = await prisma.quotationItem.findMany({
    where: { quotationId: qs.quotationId },
    select: { id: true, quantity: true },
  });
  const qtyById = new Map(items.map((it) => [it.id, it.quantity]));
  const validItemIds = new Set(items.map((it) => it.id));

  const clean = (input.prices ?? []).filter((p) =>
    validItemIds.has(p.quotationItemId),
  );
  const total = round2(
    clean.reduce(
      (a, p) => a + (qtyById.get(p.quotationItemId) ?? 0) * (Number(p.unitPrice) || 0),
      0,
    ),
  );

  await prisma.$transaction([
    prisma.quotationSupplierItem.deleteMany({
      where: { quotationSupplierId },
    }),
    prisma.quotationSupplierItem.createMany({
      data: clean.map((p) => ({
        quotationSupplierId,
        quotationItemId: p.quotationItemId,
        unitPrice: round2(Number(p.unitPrice) || 0),
      })),
    }),
    prisma.quotationSupplier.update({
      where: { id: quotationSupplierId },
      data: {
        paymentTerm: str(input.paymentTerm, 60),
        leadTimeDays: int(input.leadTimeDays),
        total,
        respondedAt: new Date(),
      },
    }),
    prisma.quotation.update({
      where: { id: qs.quotationId },
      data: { status: "respondida" },
    }),
  ]);
  return { ok: true };
}

/** Escolhe o fornecedor vencedor e fecha a cotação. */
export async function chooseWinner(
  org: string,
  quotationId: string,
  supplierId: string,
): Promise<{ ok: boolean; error?: string }> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { suppliers: true },
  });
  if (!q || q.organizationId !== org)
    return { ok: false, error: "Cotação não encontrada." };
  const bid = q.suppliers.find((s) => s.supplierId === supplierId);
  if (!bid) return { ok: false, error: "Fornecedor não participa desta cotação." };
  if (Number(bid.total) <= 0)
    return { ok: false, error: "Registre a proposta do fornecedor antes de escolhê-lo." };

  // Segunda trava do mesmo problema. A da criação impede abrir duas cotações
  // daqui em diante; esta protege as que já existiam antes dela — e o caso em
  // que a primeira cotação foi criada, a solicitação convertida, e alguém
  // tenta fechar a segunda mesmo assim.
  if (q.requisitionId) {
    const jaFechada = await prisma.quotation.findFirst({
      where: {
        requisitionId: q.requisitionId,
        status: "fechada",
        id: { not: quotationId },
      },
      select: { number: true },
    });
    if (jaFechada)
      return {
        ok: false,
        error: `Esta solicitação já foi fechada na cotação ${jaFechada.number}. Cancele o pedido de lá antes de fechar esta.`,
      };
  }

  await prisma.$transaction([
    prisma.quotation.update({
      where: { id: quotationId },
      data: { status: "fechada", winnerSupplierId: supplierId },
    }),
    // Marca a solicitação de origem como convertida (quando houver).
    ...(q.requisitionId
      ? [
          prisma.purchaseRequisition.update({
            where: { id: q.requisitionId },
            data: { status: "convertida" },
          }),
        ]
      : []),
  ]);
  return { ok: true };
}
