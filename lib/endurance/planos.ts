import "server-only";
import { prisma } from "@/lib/db";
import { groupByMeal, isKnownMeal, type GroupedMeal } from "./meal-plan";

/**
 * Planos alimentares (cardápios) do paciente — nicho nutrição. Um plano tem
 * itens agrupados por refeição. Exclusão LÓGICA preserva planos anteriores.
 * Isolamento por organização; RBAC (planos.manage) fica nas actions.
 */

export interface PlanItem {
  meal: string;
  food: string;
  amount: string;
  notes: string;
  position: number;
}

export interface MealPlanSummary {
  id: string;
  title: string;
  goal: string;
  active: boolean;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanFull {
  id: string;
  customerId: string;
  title: string;
  goal: string;
  active: boolean;
  meals: GroupedMeal<PlanItem>[];
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanPatientRow {
  id: string;
  name: string;
  plans: number;
  hasActive: boolean;
  lastAt: string | null;
}

/** Pacientes que já têm plano, com resumo. */
export async function listPlanPatients(org: string): Promise<PlanPatientRow[]> {
  const plans = await prisma.mealPlan.findMany({
    where: { organizationId: org },
    select: { customerId: true, active: true, updatedAt: true },
  });
  if (plans.length === 0) return [];

  const byCustomer = new Map<
    string,
    { plans: number; hasActive: boolean; lastAt: Date }
  >();
  for (const p of plans) {
    const cur = byCustomer.get(p.customerId);
    if (!cur) {
      byCustomer.set(p.customerId, {
        plans: 1,
        hasActive: p.active,
        lastAt: p.updatedAt,
      });
    } else {
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

/** Planos de um paciente (mais recentes primeiro). */
export async function listMealPlans(
  org: string,
  customerId: string,
): Promise<MealPlanSummary[]> {
  const plans = await prisma.mealPlan.findMany({
    where: { organizationId: org, customerId },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      goal: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });
  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    goal: p.goal,
    active: p.active,
    itemsCount: p._count.items,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

/** Todos os planos de um paciente, completos (para o editor). */
export async function getPatientPlansFull(
  org: string,
  customerId: string,
): Promise<{ patientExists: boolean; plans: MealPlanFull[] }> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { name: true },
  });
  if (!customer) return { patientExists: false, plans: [] };

  const rows = await prisma.mealPlan.findMany({
    where: { organizationId: org, customerId },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    include: { items: true },
  });
  const plans: MealPlanFull[] = rows.map((plan) => ({
    id: plan.id,
    customerId: plan.customerId,
    title: plan.title,
    goal: plan.goal,
    active: plan.active,
    meals: groupByMeal(
      plan.items.map((it) => ({
        meal: it.meal,
        food: it.food,
        amount: it.amount,
        notes: it.notes,
        position: it.position,
      })),
    ),
    createdByName: plan.createdByName,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }));
  return { patientExists: true, plans };
}

/** Plano completo com itens agrupados por refeição. */
export async function getMealPlan(
  org: string,
  planId: string,
): Promise<MealPlanFull | null> {
  const plan = await prisma.mealPlan.findFirst({
    where: { id: planId, organizationId: org },
    include: { items: true },
  });
  if (!plan) return null;

  const items: PlanItem[] = plan.items.map((it) => ({
    meal: it.meal,
    food: it.food,
    amount: it.amount,
    notes: it.notes,
    position: it.position,
  }));

  return {
    id: plan.id,
    customerId: plan.customerId,
    title: plan.title,
    goal: plan.goal,
    active: plan.active,
    meals: groupByMeal(items),
    createdByName: plan.createdByName,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export type PlanResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface PlanInput {
  customerId: string;
  title?: string;
  goal?: string;
  active?: boolean;
  items: { meal: string; food: string; amount?: string; notes?: string }[];
}

/** Normaliza + valida os itens: descarta linhas sem alimento; ordena position. */
function normalizeItems(
  raw: PlanInput["items"],
): { meal: string; food: string; amount: string; notes: string; position: number }[] {
  return raw
    .filter((it) => it.food && it.food.trim().length > 0)
    .map((it, i) => ({
      meal: isKnownMeal(it.meal) ? it.meal : "almoco",
      food: it.food.trim(),
      amount: (it.amount ?? "").trim(),
      notes: (it.notes ?? "").trim(),
      position: i,
    }));
}

export async function createPlan(
  org: string,
  actor: { id: string; name: string },
  input: PlanInput,
): Promise<PlanResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um alimento ao plano." };

  const created = await prisma.mealPlan.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      title: (input.title ?? "").trim() || "Plano alimentar",
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

export async function updatePlan(
  org: string,
  planId: string,
  input: Omit<PlanInput, "customerId">,
): Promise<PlanResult> {
  const existing = await prisma.mealPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Plano não encontrado." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um alimento ao plano." };

  // Substitui os itens por completo (editor devolve o estado final do plano).
  await prisma.$transaction([
    prisma.mealPlanItem.deleteMany({ where: { planId } }),
    prisma.mealPlan.update({
      where: { id: planId },
      data: {
        title: (input.title ?? "").trim() || "Plano alimentar",
        goal: (input.goal ?? "").trim(),
        ...(input.active !== undefined ? { active: input.active } : {}),
        items: { create: items },
      },
    }),
  ]);
  return { ok: true, id: planId };
}

export async function setPlanActive(
  org: string,
  planId: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.mealPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Plano não encontrado." };
  await prisma.mealPlan.update({ where: { id: planId }, data: { active } });
  return { ok: true };
}

/** Exclusão LÓGICA — preserva o histórico de planos do paciente. */
export async function deletePlan(
  org: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.mealPlan.findFirst({
    where: { id: planId, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Plano não encontrado." };
  await prisma.mealPlan.update({
    where: { id: planId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
