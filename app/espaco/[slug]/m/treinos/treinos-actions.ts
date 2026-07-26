"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createWorkout,
  updateWorkout,
  deleteWorkout,
  setWorkoutActive,
} from "@/lib/endurance/treinos";

/** Ações das Fichas de treino. Gate `treinos.manage` em toda mutação. */

export type WorkoutActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface WorkoutItemPayload {
  group: string;
  exercise: string;
  sets?: string;
  load?: string;
  rest?: string;
  notes?: string;
}

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/treinos/${customerId}`);
  revalidatePath(`/espaco/${slug}/m/treinos`);
}

export async function saveWorkoutAction(payload: {
  id?: string;
  customerId: string;
  title?: string;
  goal?: string;
  active?: boolean;
  items: WorkoutItemPayload[];
}): Promise<WorkoutActionResult> {
  const gate = await requirePermission("treinos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = payload.id
    ? await updateWorkout(s.org, payload.id, {
        title: payload.title,
        goal: payload.goal,
        active: payload.active,
        items: payload.items,
      })
    : await createWorkout(
        s.org,
        { id: s.sub, name: s.name },
        {
          customerId: payload.customerId,
          title: payload.title,
          goal: payload.goal,
          active: payload.active,
          items: payload.items,
        },
      );
  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "workout.update" : "workout.create",
    `${payload.id ? "Editou" : "Criou"} uma ficha de treino`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function setWorkoutActiveAction(payload: {
  id: string;
  customerId: string;
  active: boolean;
}): Promise<WorkoutActionResult> {
  const gate = await requirePermission("treinos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setWorkoutActive(s.org, payload.id, payload.active);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(
    s,
    "workout.active",
    `${payload.active ? "Ativou" : "Arquivou"} uma ficha de treino`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export async function deleteWorkoutAction(payload: {
  id: string;
  customerId: string;
}): Promise<WorkoutActionResult> {
  const gate = await requirePermission("treinos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteWorkout(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "workout.delete", "Removeu uma ficha de treino", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export interface StudentHit {
  id: string;
  name: string;
  phone: string;
}

export async function searchStudentsAction(term: string): Promise<StudentHit[]> {
  const gate = await requirePermission("treinos.manage");
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
