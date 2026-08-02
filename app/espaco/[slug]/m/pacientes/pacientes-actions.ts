"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createPatient,
  updatePatient,
  deletePatient,
  getPatient,
  addAttachment,
  deleteAttachment,
  type PatientInput,
  type PatientDetail,
} from "@/lib/endurance/pacientes";

/** Ações do Cadastro de pacientes. Gate `pacientes.manage` em toda mutação. */

export type PatientActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string, customerId?: string) {
  revalidatePath(`/espaco/${slug}/m/pacientes`);
  if (customerId) revalidatePath(`/espaco/${slug}/m/pacientes/${customerId}`);
}

export async function savePatientAction(
  payload: PatientInput & { id?: string },
): Promise<PatientActionResult> {
  const gate = await requirePermission("pacientes.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const { id, ...input } = payload;
  const res = id
    ? await updatePatient(s.org, id, input)
    : await createPatient(s.org, input);
  if (!res.ok) return res;
  await logActivity(
    s,
    id ? "patient.update" : "patient.create",
    `${id ? "Editou" : "Cadastrou"} o paciente ${payload.name}`,
    res.id,
  );
  revalidate(s.slug, res.id);
  return { ok: true, id: res.id };
}

/**
 * Exclusão (lógica) da ficha do paciente. O histórico — consultas, prontuário e
 * financeiro — continua íntegro; só a ficha sai das listagens.
 */
export async function deletePatientAction(
  customerId: string,
): Promise<PatientActionResult> {
  const gate = await requirePermission("pacientes.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deletePatient(s.org, customerId);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao excluir." };
  await logActivity(s, "patient.delete", "Excluiu a ficha de um paciente", customerId);
  revalidate(s.slug, customerId);
  return { ok: true };
}

export async function getPatientAction(
  customerId: string,
): Promise<PatientDetail | null> {
  const gate = await requirePermission("pacientes.manage");
  if (!gate.ok) return null;
  return getPatient(gate.session.org, customerId);
}

export async function addAttachmentAction(payload: {
  customerId: string;
  name: string;
  category?: string;
  url: string;
  notes?: string;
}): Promise<PatientActionResult> {
  const gate = await requirePermission("pacientes.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addAttachment(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "patient.attachment.add", `Anexou "${payload.name}" ao paciente`, payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deleteAttachmentAction(payload: {
  id: string;
  customerId: string;
}): Promise<PatientActionResult> {
  const gate = await requirePermission("pacientes.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteAttachment(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "patient.attachment.delete", "Removeu um anexo do paciente", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}
