"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { emitNfe } from "@/lib/endurance/nfe-service";
import { cancelNfce } from "@/lib/endurance/fiscal-service";
import { logActivity } from "@/lib/endurance/activity-log";

export async function emitNfeAction(
  saleId: string,
): Promise<{ ok: boolean; error?: string; docId?: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await emitNfe(s.org, saleId);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/nfe`);
    await logActivity(s, "nfe.emit", `Emitiu NF-e nº ${res.numero}`, res.docId);
  }
  return res.ok ? { ok: true, docId: res.docId } : { ok: false, error: res.error };
}

export async function cancelNfeAction(
  docId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await cancelNfce(s.org, docId, motivo);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/nfe`);
    await logActivity(
      s,
      "nfe.cancel",
      `Cancelou NF-e${motivo ? ` (motivo: ${motivo.trim().slice(0, 80)})` : ""}`,
      docId,
    );
  }
  return res;
}
