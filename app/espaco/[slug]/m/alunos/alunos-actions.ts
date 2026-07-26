"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createStudent,
  updateStudent,
  setStudentStatus,
  getStudent,
  type StudentDetail,
} from "@/lib/endurance/alunos";

/** Ações do Cadastro de alunos. Gate `alunos.manage` em toda mutação. */

export type StudentActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface StudentPayload {
  id?: string; // customerId (edição)
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  status?: string;
  plan?: string;
  monthlyFee?: number;
  goal?: string;
  notes?: string;
  birthDate?: string | null;
  enrolledAt?: string | null;
}

export async function saveStudentAction(
  payload: StudentPayload,
): Promise<StudentActionResult> {
  const gate = await requirePermission("alunos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = payload.id
    ? await updateStudent(s.org, payload.id, payload)
    : await createStudent(s.org, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "student.update" : "student.create",
    `${payload.id ? "Editou" : "Cadastrou"} o aluno ${payload.name}`,
    res.id,
  );
  revalidatePath(`/espaco/${s.slug}/m/alunos`);
  return { ok: true, id: res.id };
}

export async function getStudentAction(
  customerId: string,
): Promise<StudentDetail | null> {
  const gate = await requirePermission("alunos.manage");
  if (!gate.ok) return null;
  return getStudent(gate.session.org, customerId);
}

export async function setStudentStatusAction(
  customerId: string,
  status: string,
): Promise<StudentActionResult> {
  const gate = await requirePermission("alunos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setStudentStatus(s.org, customerId, status);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "student.status", `Alterou a situação de um aluno para ${status}`, customerId);
  revalidatePath(`/espaco/${s.slug}/m/alunos`);
  return { ok: true };
}
