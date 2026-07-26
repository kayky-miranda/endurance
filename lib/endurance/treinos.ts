import "server-only";
import { prisma } from "@/lib/db";
import { groupByDivision, type GroupedWorkout } from "./workout";

/**
 * Fichas de treino (academia): grupos de exercícios (divisão A/B/C…) por aluno.
 * Vários treinos por aluno; exclusão LÓGICA preserva o histórico. Isolado por
 * organização; RBAC (treinos.manage) nas actions.
 */

export interface WorkoutItem {
  group: string;
  exercise: string;
  sets: string;
  load: string;
  rest: string;
  notes: string;
  position: number;
}

export interface WorkoutFull {
  id: string;
  customerId: string;
  title: string;
  goal: string;
  active: boolean;
  groups: GroupedWorkout<WorkoutItem>[];
  createdByName: string;
  updatedAt: string;
}

export interface WorkoutPatientRow {
  id: string;
  name: string;
  plans: number;
  hasActive: boolean;
  lastAt: string | null;
}

export async function listWorkoutPatients(
  org: string,
): Promise<WorkoutPatientRow[]> {
  const plans = await prisma.workoutPlan.findMany({
    where: { organizationId: org },
    select: { customerId: true, active: true, updatedAt: true },
  });
  if (plans.length === 0) return [];

  const byCustomer = new Map<string, { plans: number; hasActive: boolean; lastAt: Date }>();
  for (const p of plans) {
    const cur = byCustomer.get(p.customerId);
    if (!cur) byCustomer.set(p.customerId, { plans: 1, hasActive: p.active, lastAt: p.updatedAt });
    else {
      cur.plans++;
      cur.hasActive = cur.hasActive || p.active;
      if (p.updatedAt > cur.lastAt) cur.lastAt = p.updatedAt;
    }
  }
  const ids = [...byCustomer.keys()];
  const customers = await prisma.customer.findMany({
    where: { organizationId: org, id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  return [...byCustomer.entries()]
    .filter(([id]) => nameById.has(id))
    .map(([id, info]) => ({
      id,
      name: nameById.get(id) as string,
      plans: info.plans,
      hasActive: info.hasActive,
      lastAt: info.lastAt.toISOString(),
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function getPatientWorkoutsFull(
  org: string,
  customerId: string,
): Promise<{ patientExists: boolean; workouts: WorkoutFull[] }> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { name: true },
  });
  if (!customer) return { patientExists: false, workouts: [] };

  const rows = await prisma.workoutPlan.findMany({
    where: { organizationId: org, customerId },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    include: { items: true },
  });
  const workouts: WorkoutFull[] = rows.map((w) => ({
    id: w.id,
    customerId: w.customerId,
    title: w.title,
    goal: w.goal,
    active: w.active,
    groups: groupByDivision(
      w.items.map((it) => ({
        group: it.group,
        exercise: it.exercise,
        sets: it.sets,
        load: it.load,
        rest: it.rest,
        notes: it.notes,
        position: it.position,
      })),
    ),
    createdByName: w.createdByName,
    updatedAt: w.updatedAt.toISOString(),
  }));
  return { patientExists: true, workouts };
}

export type WorkoutResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface WorkoutInput {
  customerId: string;
  title?: string;
  goal?: string;
  active?: boolean;
  items: {
    group: string;
    exercise: string;
    sets?: string;
    load?: string;
    rest?: string;
    notes?: string;
  }[];
}

function normalizeItems(raw: WorkoutInput["items"]) {
  return raw
    .filter((it) => it.exercise && it.exercise.trim().length > 0)
    .map((it, i) => ({
      group: (it.group ?? "A").trim() || "A",
      exercise: it.exercise.trim(),
      sets: (it.sets ?? "").trim(),
      load: (it.load ?? "").trim(),
      rest: (it.rest ?? "").trim(),
      notes: (it.notes ?? "").trim(),
      position: i,
    }));
}

export async function createWorkout(
  org: string,
  actor: { id: string; name: string },
  input: WorkoutInput,
): Promise<WorkoutResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Aluno não encontrado." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um exercício ao treino." };

  const created = await prisma.workoutPlan.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      title: (input.title ?? "").trim() || "Ficha de treino",
      goal: (input.goal ?? "").trim(),
      active: input.active ?? true,
      createdById: actor.id,
      createdByName: actor.name,
      items: { create: items },
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateWorkout(
  org: string,
  planId: string,
  input: Omit<WorkoutInput, "customerId">,
): Promise<WorkoutResult> {
  const existing = await prisma.workoutPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Treino não encontrado." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um exercício ao treino." };

  await prisma.$transaction([
    prisma.workoutItem.deleteMany({ where: { planId } }),
    prisma.workoutPlan.update({
      where: { id: planId },
      data: {
        title: (input.title ?? "").trim() || "Ficha de treino",
        goal: (input.goal ?? "").trim(),
        ...(input.active !== undefined ? { active: input.active } : {}),
        items: { create: items },
      },
    }),
  ]);
  return { ok: true, id: planId };
}

export async function setWorkoutActive(
  org: string,
  planId: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.workoutPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Treino não encontrado." };
  await prisma.workoutPlan.update({ where: { id: planId }, data: { active } });
  return { ok: true };
}

export async function deleteWorkout(
  org: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.workoutPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Treino não encontrado." };
  await prisma.workoutPlan.update({
    where: { id: planId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
