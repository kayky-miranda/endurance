import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { requiredApprovalLevel } from "./approval-rules";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";
import { REQ_STATUSES, PRIORITIES, type ReqStatus } from "./requisition-status";

// ---------------------------------------------------------------------------
// Serviço de Solicitações de Compra (requisição de materiais). Fluxo de status:
//   aberta → em_aprovacao → aprovada | rejeitada → convertida
// Escopado por organizationId; o RBAC fica na camada de actions.
// Constantes/rótulos de status vivem em ./requisition-status (puro, p/ o client).
// ---------------------------------------------------------------------------

export { REQ_STATUSES, reqStatusLabel } from "./requisition-status";
export type { ReqStatus } from "./requisition-status";

const PRIORITY_SET = new Set<string>(PRIORITIES);

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0));
const round2 = (n: number) => Math.round(n * 100) / 100;
const prio = (v: unknown) => (PRIORITY_SET.has(String(v)) ? String(v) : "media");

export interface RequisitionItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
  priority?: string;
  justification?: string;
  estimatedUnitCost?: number;
}

export interface RequisitionInput {
  costCenterId?: string | null;
  priority?: string;
  note?: string;
  items: RequisitionItemInput[];
}

export interface RequisitionRow {
  id: string;
  number: string;
  requester: string;
  costCenter: string;
  status: string;
  priority: string;
  estimatedTotal: number;
  itemsCount: number;
  createdAt: string;
}

export interface RequisitionDetail {
  id: string;
  number: string;
  requester: string;
  costCenterId: string | null;
  costCenter: string;
  status: string;
  priority: string;
  note: string;
  estimatedTotal: number;
  createdAt: string;
  items: {
    id: string;
    productId: string | null;
    name: string;
    quantity: number;
    priority: string;
    justification: string;
    estimatedUnitCost: number;
  }[];
  approvals: {
    id: string;
    level: string;
    status: string;
    approverName: string;
    note: string;
    at: string;
  }[];
}

export interface RequisitionKpis {
  abertas: number;
  emAprovacao: number;
  aprovadas: number;
  valorAberto: number;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Próximo número humano sequencial (SC-00001) por organização. */
async function nextNumber(org: string): Promise<string> {
  const count = await prisma.purchaseRequisition.count({
    where: { organizationId: org },
  });
  return `SC-${String(count + 1).padStart(5, "0")}`;
}

function normalizeItems(
  items: RequisitionItemInput[],
): { ok: true; items: Required<RequisitionItemInput>[]; total: number } | {
  ok: false;
  error: string;
} {
  const clean = (items ?? [])
    .map((i) => ({
      productId: i.productId || null,
      name: str(i.name, 160),
      quantity: int(i.quantity),
      priority: prio(i.priority),
      justification: str(i.justification, 300),
      estimatedUnitCost: round2(Number(i.estimatedUnitCost) || 0),
    }))
    .filter((i) => i.name && i.quantity > 0);
  if (clean.length === 0)
    return { ok: false, error: "Adicione ao menos um item à solicitação." };
  const total = round2(
    clean.reduce((a, i) => a + i.quantity * i.estimatedUnitCost, 0),
  );
  return { ok: true, items: clean, total };
}

export interface RequisitionListResult {
  rows: RequisitionRow[];
  meta: PageMeta;
  kpis: RequisitionKpis;
}

export async function listRequisitions(
  org: string,
  opts: { status?: string; page?: number } = {},
): Promise<RequisitionListResult> {
  const status = REQ_STATUSES.includes(opts.status as ReqStatus)
    ? opts.status
    : "";
  const where = { organizationId: org, ...(status ? { status } : {}) };

  const total = await prisma.purchaseRequisition.count({ where });
  const page = clampPage(opts.page, total);

  const [list, all] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        costCenter: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseRequisition.findMany({
      where: { organizationId: org },
      select: { status: true, estimatedTotal: true },
    }),
  ]);

  const kpis: RequisitionKpis = {
    abertas: all.filter((r) => r.status === "aberta").length,
    emAprovacao: all.filter((r) => r.status === "em_aprovacao").length,
    aprovadas: all.filter((r) => r.status === "aprovada").length,
    valorAberto: round2(
      all
        .filter((r) => r.status === "aberta" || r.status === "em_aprovacao")
        .reduce((a, r) => a + money(r.estimatedTotal), 0),
    ),
  };

  return {
    rows: list.map((r) => ({
      id: r.id,
      number: r.number,
      requester: r.requesterName,
      costCenter: r.costCenter?.name ?? "",
      status: r.status,
      priority: r.priority,
      estimatedTotal: money(r.estimatedTotal),
      itemsCount: r._count.items,
      createdAt: fmtDate(r.createdAt),
    })),
    meta: pageMeta(page, total),
    kpis,
  };
}

export async function getRequisitionDetail(
  org: string,
  id: string,
): Promise<RequisitionDetail | null> {
  const r = await prisma.purchaseRequisition.findUnique({
    where: { id },
    include: {
      costCenter: { select: { name: true } },
      items: true,
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r || r.organizationId !== org) return null;
  return {
    id: r.id,
    number: r.number,
    requester: r.requesterName,
    costCenterId: r.costCenterId,
    costCenter: r.costCenter?.name ?? "",
    status: r.status,
    priority: r.priority,
    note: r.note,
    estimatedTotal: money(r.estimatedTotal),
    createdAt: fmtDateTime(r.createdAt),
    items: r.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      priority: it.priority,
      justification: it.justification,
      estimatedUnitCost: money(it.estimatedUnitCost),
    })),
    approvals: r.approvals.map((a) => ({
      id: a.id,
      level: a.level,
      status: a.status,
      approverName: a.approverName,
      note: a.note,
      at: a.decidedAt ? fmtDateTime(a.decidedAt) : fmtDateTime(a.createdAt),
    })),
  };
}

export async function createRequisition(
  org: string,
  requester: { id: string; name: string },
  input: RequisitionInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const norm = normalizeItems(input.items);
  if (!norm.ok) return norm;

  let costCenterId: string | null = null;
  if (input.costCenterId) {
    const cc = await prisma.costCenter.findUnique({
      where: { id: input.costCenterId },
    });
    if (!cc || cc.organizationId !== org)
      return { ok: false, error: "Centro de custo inválido." };
    costCenterId = cc.id;
  }

  // Retry em colisão de número (constraint @@unique[org, number]).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.purchaseRequisition.create({
        data: {
          organizationId: org,
          number: await nextNumber(org),
          requesterId: requester.id,
          requesterName: requester.name,
          costCenterId,
          status: "aberta",
          priority: prio(input.priority),
          estimatedTotal: norm.total,
          note: str(input.note, 500),
          items: { create: norm.items },
        },
      });
      return { ok: true, id: created.id };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  return { ok: false, error: "Não foi possível gerar o número da solicitação." };
}

export async function updateRequisition(
  org: string,
  id: string,
  input: RequisitionInput,
): Promise<{ ok: boolean; error?: string }> {
  const r = await prisma.purchaseRequisition.findUnique({ where: { id } });
  if (!r || r.organizationId !== org)
    return { ok: false, error: "Solicitação não encontrada." };
  if (r.status !== "aberta")
    return { ok: false, error: "Só é possível editar solicitações abertas." };
  const norm = normalizeItems(input.items);
  if (!norm.ok) return norm;

  let costCenterId: string | null = null;
  if (input.costCenterId) {
    const cc = await prisma.costCenter.findUnique({
      where: { id: input.costCenterId },
    });
    if (!cc || cc.organizationId !== org)
      return { ok: false, error: "Centro de custo inválido." };
    costCenterId = cc.id;
  }

  await prisma.$transaction([
    prisma.purchaseRequisitionItem.deleteMany({ where: { requisitionId: id } }),
    prisma.purchaseRequisition.update({
      where: { id },
      data: {
        costCenterId,
        priority: prio(input.priority),
        note: str(input.note, 500),
        estimatedTotal: norm.total,
        items: { create: norm.items },
      },
    }),
  ]);
  return { ok: true };
}

/**
 * Envia a solicitação para aprovação: calcula o nível exigido pelo valor e cria
 * a etapa de aprovação pendente. Só a partir de "aberta".
 */
export async function submitForApproval(
  org: string,
  id: string,
): Promise<{ ok: boolean; level?: string; error?: string }> {
  const r = await prisma.purchaseRequisition.findUnique({ where: { id } });
  if (!r || r.organizationId !== org)
    return { ok: false, error: "Solicitação não encontrada." };
  if (r.status !== "aberta")
    return { ok: false, error: "Esta solicitação já foi enviada." };

  const level = requiredApprovalLevel(money(r.estimatedTotal));
  await prisma.$transaction([
    prisma.purchaseApproval.create({
      data: { requisitionId: id, level, status: "pendente" },
    }),
    prisma.purchaseRequisition.update({
      where: { id },
      data: { status: "em_aprovacao" },
    }),
  ]);
  return { ok: true, level };
}

export async function deleteRequisition(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await prisma.purchaseRequisition.findUnique({ where: { id } });
  if (!r || r.organizationId !== org)
    return { ok: false, error: "Solicitação não encontrada." };
  if (r.status !== "aberta")
    return {
      ok: false,
      error: "Só é possível excluir solicitações abertas.",
    };
  await prisma.purchaseRequisition.delete({ where: { id } });
  return { ok: true };
}

// ---- Centros de custo ----
export interface CostCenterRow {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export async function listCostCenters(
  org: string,
  onlyActive = false,
): Promise<CostCenterRow[]> {
  const list = await prisma.costCenter.findMany({
    where: { organizationId: org, ...(onlyActive ? { active: true } : {}) },
    orderBy: { name: "asc" },
  });
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    active: c.active,
  }));
}

export async function createCostCenter(
  org: string,
  input: { name: string; code?: string },
): Promise<{ ok: boolean; error?: string }> {
  const name = str(input.name, 80);
  if (!name) return { ok: false, error: "Informe o nome do centro de custo." };
  const exists = await prisma.costCenter.findFirst({
    where: { organizationId: org, name },
  });
  if (exists) return { ok: false, error: "Já existe um centro de custo com esse nome." };
  await prisma.costCenter.create({
    data: { organizationId: org, name, code: str(input.code, 30) },
  });
  return { ok: true };
}
