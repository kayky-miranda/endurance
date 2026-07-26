"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createPrescription,
  updatePrescription,
  deletePrescription,
  getPrescription,
  type PrescriptionFull,
} from "@/lib/endurance/prescriptions";
import { searchCid, type CidCode } from "@/lib/endurance/cid";

/** Ações do receituário. Gate `prontuario.manage` (dado clínico). */

export type PrescriptionActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface Payload {
  id?: string;
  customerId: string;
  professionalId?: string | null;
  professional?: string;
  professionalCouncil?: string;
  cid?: string;
  cidDescription?: string;
  instructions?: string;
  items: { medication: string; dosage?: string; quantity?: string; notes?: string }[];
}

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/prontuario/${customerId}`);
}

export async function savePrescriptionAction(
  payload: Payload,
): Promise<PrescriptionActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = payload.id
    ? await updatePrescription(s.org, payload.id, payload)
    : await createPrescription(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "prescription.update" : "prescription.create",
    "Emitiu/editou uma receita",
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deletePrescriptionAction(payload: {
  id: string;
  customerId: string;
}): Promise<PrescriptionActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deletePrescription(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "prescription.delete", "Removeu uma receita", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export async function getPrescriptionAction(
  id: string,
): Promise<PrescriptionFull | null> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return null;
  return getPrescription(gate.session.org, id);
}

/** Busca no catálogo CID-10 curado (para autocompletar). */
export async function searchCidAction(term: string): Promise<CidCode[]> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return [];
  return searchCid(term);
}
