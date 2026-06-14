"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  changePlan,
  setCancelAtPeriodEnd,
} from "@/lib/endurance/billing-service";
import { planById } from "@/lib/endurance/billing";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

/** Troca o plano contratado do espaço. Imediato e gera fatura se for pago. */
export async function changePlanAction(planId: string): Promise<R> {
  const gate = await requirePermission("subscription.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const plan = planById(planId);
  if (!plan) return { ok: false, error: "Plano inválido." };

  const res = await changePlan(s.org, planId);
  if (!res.ok) return res;

  revalidatePath(`/espaco/${s.slug}/assinatura`);
  await logActivity(
    s,
    "subscription.change",
    `Mudou o plano para ${plan.name}${res.invoiced ? " (fatura emitida)" : ""}`,
  );
  return { ok: true };
}

/** Agenda o cancelamento da assinatura ao fim do ciclo atual. */
export async function cancelSubscriptionAction(): Promise<R> {
  const gate = await requirePermission("subscription.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = await setCancelAtPeriodEnd(s.org, true);
  if (!res.ok) return res;

  revalidatePath(`/espaco/${s.slug}/assinatura`);
  await logActivity(
    s,
    "subscription.cancel",
    "Agendou o cancelamento da assinatura para o fim do ciclo",
  );
  return { ok: true };
}

/** Desfaz um cancelamento agendado — a assinatura segue renovando. */
export async function resumeSubscriptionAction(): Promise<R> {
  const gate = await requirePermission("subscription.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = await setCancelAtPeriodEnd(s.org, false);
  if (!res.ok) return res;

  revalidatePath(`/espaco/${s.slug}/assinatura`);
  await logActivity(
    s,
    "subscription.resume",
    "Reativou a renovação automática da assinatura",
  );
  return { ok: true };
}
