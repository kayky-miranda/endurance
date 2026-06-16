import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ---------------------------------------------------------------------------
// Caixa de aprovações de compra. Lista as solicitações pendentes de decisão e
// registra cada decisão (aprovar / rejeitar / solicitar ajuste) — histórico
// completo na trilha de PurchaseApproval. Escopado por organizationId.
// ---------------------------------------------------------------------------

export type ApprovalDecision = "aprovar" | "rejeitar" | "ajuste";

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtDateTime = (d: Date) =>
  d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface PendingApprovalRow {
  approvalId: string;
  requisitionId: string;
  number: string;
  level: string;
  requester: string;
  costCenter: string;
  priority: string;
  estimatedTotal: number;
  itemsCount: number;
  createdAt: string;
  items: { name: string; quantity: number; estimatedUnitCost: number }[];
}

export interface ApprovalKpis {
  pendentes: number;
  valorPendente: number;
  aprovadasMes: number;
  rejeitadasMes: number;
}

export interface PendingApprovalsResult {
  rows: PendingApprovalRow[];
  meta: PageMeta;
  kpis: ApprovalKpis;
}

export async function listPendingApprovals(
  org: string,
  opts: { page?: number } = {},
): Promise<PendingApprovalsResult> {
  const where = {
    status: "pendente",
    requisition: { is: { organizationId: org } },
  };

  const total = await prisma.purchaseApproval.count({ where });
  const page = clampPage(opts.page, total);

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const [list, decided, pendingAll] = await Promise.all([
    prisma.purchaseApproval.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        requisition: {
          include: {
            costCenter: { select: { name: true } },
            items: true,
          },
        },
      },
    }),
    prisma.purchaseApproval.findMany({
      where: {
        requisition: { is: { organizationId: org } },
        decidedAt: { gte: startMonth },
      },
      select: { status: true },
    }),
    prisma.purchaseApproval.findMany({
      where,
      include: { requisition: { select: { estimatedTotal: true } } },
    }),
  ]);

  return {
    rows: list.map((a) => ({
      approvalId: a.id,
      requisitionId: a.requisitionId,
      number: a.requisition.number,
      level: a.level,
      requester: a.requisition.requesterName,
      costCenter: a.requisition.costCenter?.name ?? "",
      priority: a.requisition.priority,
      estimatedTotal: money(a.requisition.estimatedTotal),
      itemsCount: a.requisition.items.length,
      createdAt: fmtDateTime(a.createdAt),
      items: a.requisition.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        estimatedUnitCost: money(it.estimatedUnitCost),
      })),
    })),
    meta: pageMeta(page, total),
    kpis: {
      pendentes: total,
      valorPendente: round2(
        pendingAll.reduce((acc, a) => acc + money(a.requisition.estimatedTotal), 0),
      ),
      aprovadasMes: decided.filter((d) => d.status === "aprovado").length,
      rejeitadasMes: decided.filter((d) => d.status === "rejeitado").length,
    },
  };
}

const DECISION_MAP: Record<
  ApprovalDecision,
  { approval: string; requisition: string }
> = {
  aprovar: { approval: "aprovado", requisition: "aprovada" },
  rejeitar: { approval: "rejeitado", requisition: "rejeitada" },
  // "Solicitar ajuste" devolve a solicitação ao autor (volta para "aberta").
  ajuste: { approval: "ajuste", requisition: "aberta" },
};

/**
 * Registra a decisão de uma etapa de aprovação e atualiza o status da
 * solicitação. Idempotente: só decide etapas ainda pendentes.
 */
export async function decideApproval(
  org: string,
  approvalId: string,
  decision: ApprovalDecision,
  approver: { id: string; name: string },
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const map = DECISION_MAP[decision];
  if (!map) return { ok: false, error: "Decisão inválida." };

  const approval = await prisma.purchaseApproval.findUnique({
    where: { id: approvalId },
    include: { requisition: { select: { organizationId: true, status: true } } },
  });
  if (!approval || approval.requisition.organizationId !== org)
    return { ok: false, error: "Aprovação não encontrada." };
  if (approval.status !== "pendente")
    return { ok: false, error: "Esta solicitação já foi decidida." };

  await prisma.$transaction([
    prisma.purchaseApproval.update({
      where: { id: approvalId },
      data: {
        status: map.approval,
        approverId: approver.id,
        approverName: approver.name,
        note: str(note, 300),
        decidedAt: new Date(),
      },
    }),
    prisma.purchaseRequisition.update({
      where: { id: approval.requisitionId },
      data: { status: map.requisition },
    }),
  ]);
  return { ok: true };
}
