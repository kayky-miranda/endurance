"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { addAssessment, deleteAssessment } from "@/lib/endurance/avaliacao";

/** Ações da Avaliação física. Gate `avaliacao.manage` em toda mutação. */

export type AssessmentActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

type Measures = {
  weightKg?: number | null;
  heightCm?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  restingHr?: number | null;
};

function combine(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export async function addAssessmentAction(payload: {
  customerId: string;
  date: string;
  measures: Measures;
  notes?: string;
}): Promise<AssessmentActionResult> {
  const gate = await requirePermission("avaliacao.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addAssessment(
    s.org,
    { id: s.sub, name: s.name },
    {
      customerId: payload.customerId,
      assessedAt: combine(payload.date),
      ...payload.measures,
      notes: payload.notes,
    },
  );
  if (!res.ok) return res;
  await logActivity(
    s,
    "assessment.add",
    "Registrou uma avaliação física de um aluno",
    payload.customerId,
  );
  revalidatePath(`/espaco/${s.slug}/m/avaliacao/${payload.customerId}`);
  return { ok: true, id: res.id };
}

export async function deleteAssessmentAction(payload: {
  id: string;
  customerId: string;
}): Promise<AssessmentActionResult> {
  const gate = await requirePermission("avaliacao.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteAssessment(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "assessment.delete", "Removeu uma avaliação física", payload.customerId);
  revalidatePath(`/espaco/${s.slug}/m/avaliacao/${payload.customerId}`);
  return { ok: true };
}

export interface StudentHit {
  id: string;
  name: string;
  phone: string;
}

export async function searchStudentsAction(term: string): Promise<StudentHit[]> {
  const gate = await requirePermission("avaliacao.manage");
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
