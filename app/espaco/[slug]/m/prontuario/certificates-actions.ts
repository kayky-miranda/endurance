"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createCertificate,
  updateCertificate,
  deleteCertificate,
  getCertificate,
  type CertificateFull,
} from "@/lib/endurance/certificates";

/** Ações dos atestados. Gate `prontuario.manage` (dado clínico). */

export type CertificateActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface Payload {
  id?: string;
  customerId: string;
  professionalId?: string | null;
  professional?: string;
  professionalCouncil?: string;
  kind?: string;
  cid?: string;
  cidDescription?: string;
  days?: number | null;
  startDate?: string | null;
  text?: string;
}

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/prontuario/${customerId}`);
}

export async function saveCertificateAction(
  payload: Payload,
): Promise<CertificateActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const actor = { id: s.sub, name: s.name };
  const res = payload.id
    ? await updateCertificate(s.org, payload.id, payload, actor)
    : await createCertificate(s.org, actor, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "certificate.update" : "certificate.create",
    "Emitiu/editou um atestado",
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deleteCertificateAction(payload: {
  id: string;
  customerId: string;
}): Promise<CertificateActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteCertificate(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "certificate.delete", "Removeu um atestado", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export async function getCertificateAction(
  id: string,
): Promise<CertificateFull | null> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return null;
  return getCertificate(gate.session.org, id);
}
