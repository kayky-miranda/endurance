"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  createRequisition,
  updateRequisition,
  submitForApproval,
  deleteRequisition,
  getRequisitionDetail,
  createCostCenter,
  type RequisitionInput,
  type RequisitionDetail,
} from "@/lib/endurance/requisitions";
import { approvalLevelLabel } from "@/lib/endurance/approval-rules";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/solicitacoes`);
}

export async function createRequisitionAction(
  input: RequisitionInput,
): Promise<R & { id?: string }> {
  const gate = await requirePermission("purchasing.request");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createRequisition(
    s.org,
    { id: s.sub, name: s.name },
    input,
  );
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "requisition.create",
      `Criou solicitação de compra com ${(input.items ?? []).length} item(ns)`,
      res.id,
    );
  }
  return res;
}

export async function updateRequisitionAction(
  id: string,
  input: RequisitionInput,
): Promise<R> {
  const gate = await requirePermission("purchasing.request");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await updateRequisition(s.org, id, input);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "requisition.update", "Editou uma solicitação de compra", id);
  }
  return res;
}

export async function submitRequisitionAction(id: string): Promise<R> {
  const gate = await requirePermission("purchasing.request");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await submitForApproval(s.org, id);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/m/aprovacoes`);
    await logActivity(
      s,
      "requisition.submit",
      `Enviou solicitação para aprovação (${approvalLevelLabel(res.level ?? "")})`,
      id,
    );
  }
  return res;
}

export async function deleteRequisitionAction(id: string): Promise<R> {
  const gate = await requirePermission("purchasing.request");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteRequisition(s.org, id);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "requisition.delete", "Excluiu uma solicitação de compra", id);
  }
  return res;
}

export async function loadRequisitionAction(
  id: string,
): Promise<{ ok: boolean; error?: string; detail?: RequisitionDetail }> {
  const gate = await requirePermission("purchasing.request");
  if (!gate.ok) return gate;
  const detail = await getRequisitionDetail(gate.session.org, id);
  if (!detail) return { ok: false, error: "Solicitação não encontrada." };
  return { ok: true, detail };
}

export async function createCostCenterAction(input: {
  name: string;
  code?: string;
}): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createCostCenter(s.org, input);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "costcenter.create",
      `Cadastrou centro de custo ${String(input.name ?? "").trim().slice(0, 60)}`,
    );
  }
  return res;
}
