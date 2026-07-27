"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createNote,
  updateNote,
  deleteNote,
  getPatientRecord,
} from "@/lib/endurance/prontuario";
import { summarizeClinicalNotes } from "@/lib/endurance/clinical-summary";
import { suggestConduct } from "@/lib/endurance/clinical-suggestions";

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
  cid?: string;
  cidDescription?: string;
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
  cid?: string;
  cidDescription?: string;
}): Promise<NoteActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await updateNote(s.org, payload.id, {
    title: payload.title,
    content: payload.content,
    cid: payload.cid,
    cidDescription: payload.cidDescription,
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

export type SummaryResult =
  | { ok: true; text: string; source: "ai" | "heuristic" }
  | { ok: false; error: string };

/**
 * Resumo das anotações clínicas do paciente (IA opcional + fallback heurístico).
 * Gate prontuario.manage; rate limit por usuário (é chamada potencialmente paga).
 */
export async function summarizeRecordAction(
  customerId: string,
): Promise<SummaryResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  if (!(await hit(`prontuario:summary:${s.sub}`, 12, 60_000)).ok)
    return { ok: false, error: "Muitos resumos seguidos. Aguarde um instante." };

  const record = await getPatientRecord(s.org, customerId);
  if (!record) return { ok: false, error: "Paciente não encontrado." };

  const res = await summarizeClinicalNotes(
    record.name,
    record.notes.map((n) => ({
      createdAt: n.createdAt,
      title: n.title,
      content: n.content,
      cid: n.cid,
      cidDescription: n.cidDescription,
    })),
  );
  await logActivity(s, "prontuario.summary", "Gerou resumo do prontuário", customerId);
  return { ok: true, text: res.text, source: res.source };
}

export type SuggestionResult =
  | { ok: true; text: string; source: "ai" | "unavailable" }
  | { ok: false; error: string };

/**
 * Sugestão de conduta/exames a partir do quadro digitado + CID (apoio à decisão,
 * IA opcional). Gate prontuario.manage + rate limit. O texto vem do RASCUNHO do
 * cliente; nada é gravado — é aporte para o profissional avaliar.
 */
export async function suggestConductAction(input: {
  text: string;
  cid: string;
  cidDescription: string;
}): Promise<SuggestionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  if (!(await hit(`prontuario:suggest:${s.sub}`, 15, 60_000)).ok)
    return { ok: false, error: "Muitas sugestões seguidas. Aguarde um instante." };

  const res = await suggestConduct({
    text: (input.text ?? "").slice(0, 4000),
    cid: (input.cid ?? "").trim(),
    cidDescription: (input.cidDescription ?? "").trim(),
  });
  await logActivity(s, "prontuario.suggest", "Solicitou sugestão de conduta (IA)");
  return { ok: true, text: res.text, source: res.source };
}
