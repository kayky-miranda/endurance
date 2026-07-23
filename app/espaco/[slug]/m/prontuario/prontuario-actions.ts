"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { createNote, updateNote, deleteNote } from "@/lib/endurance/prontuario";

/**
 * Ações do Prontuário clínico. Tudo abre com o gate `prontuario.manage` — é
 * dado sensível de saúde. A auditoria registra o acesso de escrita, mas nunca
 * grava o conteúdo clínico no log.
 */

export type NoteActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/prontuario/${customerId}`);
  revalidatePath(`/espaco/${slug}/m/prontuario`);
}

export async function createNoteAction(payload: {
  customerId: string;
  appointmentId?: string | null;
  title?: string;
  content: string;
}): Promise<NoteActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createNote(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    "clinical_note.create",
    "Registrou anotação no prontuário de um paciente",
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function updateNoteAction(payload: {
  id: string;
  customerId: string;
  title?: string;
  content: string;
}): Promise<NoteActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await updateNote(s.org, payload.id, {
    title: payload.title,
    content: payload.content,
  });
  if (!res.ok) return res;
  await logActivity(
    s,
    "clinical_note.update",
    "Editou uma anotação de prontuário",
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deleteNoteAction(payload: {
  id: string;
  customerId: string;
}): Promise<NoteActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteNote(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao excluir." };
  await logActivity(
    s,
    "clinical_note.delete",
    "Removeu uma anotação de prontuário",
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export interface PatientHit {
  id: string;
  name: string;
  phone: string;
}

/** Busca pacientes para iniciar um prontuário (mesma base do CRM). */
export async function searchPatientsAction(term: string): Promise<PatientHit[]> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return [];
  const q = term.trim();
  if (q.length < 2) return [];
  const rows = await prisma.customer.findMany({
    where: {
      organizationId: gate.session.org,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone }));
}
