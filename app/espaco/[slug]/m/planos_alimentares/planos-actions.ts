"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createPlan,
  updatePlan,
  deletePlan,
  setPlanActive,
} from "@/lib/endurance/planos";

/** Ações dos Planos alimentares. Gate `planos.manage` em toda mutação. */

export type PlanActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface PlanItemPayload {
  meal: string;
  food: string;
  amount?: string;
  notes?: string;
}

function revalidate(slug: string, customerId: string, planId?: string) {
  revalidatePath(`/espaco/${slug}/m/planos_alimentares/${customerId}`);
  if (planId)
    revalidatePath(`/espaco/${slug}/m/planos_alimentares/${customerId}/${planId}`);
  revalidatePath(`/espaco/${slug}/m/planos_alimentares`);
}

export async function savePlanAction(payload: {
  id?: string;
  customerId: string;
  title?: string;
  goal?: string;
  active?: boolean;
  items: PlanItemPayload[];
}): Promise<PlanActionResult> {
  const gate = await requirePermission("planos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = payload.id
    ? await updatePlan(s.org, payload.id, {
        title: payload.title,
        goal: payload.goal,
        active: payload.active,
        items: payload.items,
      })
    : await createPlan(
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
    payload.id ? "meal_plan.update" : "meal_plan.create",
    `${payload.id ? "Editou" : "Criou"} um plano alimentar`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId, res.id);
  return { ok: true, id: res.id };
}

export async function setPlanActiveAction(payload: {
  id: string;
  customerId: string;
  active: boolean;
}): Promise<PlanActionResult> {
  const gate = await requirePermission("planos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setPlanActive(s.org, payload.id, payload.active);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(
    s,
    "meal_plan.active",
    `${payload.active ? "Ativou" : "Arquivou"} um plano alimentar`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId, payload.id);
  return { ok: true };
}

export async function deletePlanAction(payload: {
  id: string;
  customerId: string;
}): Promise<PlanActionResult> {
  const gate = await requirePermission("planos.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deletePlan(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "meal_plan.delete", "Removeu um plano alimentar", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export interface PatientHit {
  id: string;
  name: string;
  phone: string;
}

export async function searchPatientsAction(term: string): Promise<PatientHit[]> {
  const gate = await requirePermission("planos.manage");
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
