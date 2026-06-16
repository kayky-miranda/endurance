"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  decideApproval,
  type ApprovalDecision,
} from "@/lib/endurance/approvals";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

const ACTION_LABEL: Record<ApprovalDecision, string> = {
  aprovar: "Aprovou",
  rejeitar: "Rejeitou",
  ajuste: "Solicitou ajuste em",
};

export async function decideApprovalAction(
  approvalId: string,
  requisitionId: string,
  decision: ApprovalDecision,
  note: string,
): Promise<R> {
  const gate = await requirePermission("purchasing.approve");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await decideApproval(
    s.org,
    approvalId,
    decision,
    { id: s.sub, name: s.name },
    note,
  );
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/aprovacoes`);
    revalidatePath(`/espaco/${s.slug}/m/solicitacoes`);
    await logActivity(
      s,
      `approval.${decision}`,
      `${ACTION_LABEL[decision]} uma solicitação de compra`,
      requisitionId,
    );
  }
  return res;
}
