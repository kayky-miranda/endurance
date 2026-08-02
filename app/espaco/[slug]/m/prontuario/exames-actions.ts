"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createLabExam,
  deleteLabExam,
  type LabExamInput,
} from "@/lib/endurance/lab-exams";

/**
 * Ações dos exames laboratoriais. Gate `prontuario.manage` — é registro clínico,
 * mesma permissão das anotações.
 */

export type ExamActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/prontuario/${customerId}`);
}

export async function createExamAction(
  payload: LabExamInput,
): Promise<ExamActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createLabExam(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    "exam.create",
    `Registrou resultado de exame (${payload.name})`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deleteExamAction(payload: {
  id: string;
  customerId: string;
}): Promise<ExamActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteLabExam(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao excluir." };
  await logActivity(s, "exam.delete", "Removeu um resultado de exame", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}
