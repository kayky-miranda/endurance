"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requirePermissionVerified } from "@/lib/auth";
import {
  changePlan,
  createExternalSubscription,
  setCancelAtPeriodEnd,
} from "@/lib/endurance/billing-service";
import { planById, isPaidPlan } from "@/lib/endurance/billing";
import { resolveBillingProvider } from "@/lib/endurance/billing-provider";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string; redirectUrl?: string | null };

/**
 * Troca o plano do espaço. Com gateway externo (Asaas) e plano pago, cria a
 * assinatura no gateway e devolve o link de checkout (redirectUrl). No modo
 * manual (ou plano grátis), a troca é imediata.
 */
export async function changePlanAction(planId: string): Promise<R> {
  // Troca de plano tem efeito financeiro — exige e-mail verificado.
  const gate = await requirePermissionVerified("subscription.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const plan = planById(planId);
  if (!plan) return { ok: false, error: "Plano inválido." };

  // Caminho com gateway: cria a assinatura e manda o cliente pro checkout.
  if (resolveBillingProvider().external && isPaidPlan(plan.id)) {
    const res = await createExternalSubscription(s.org, planId, s.email);
    if (!res.ok) return res;
    revalidatePath(`/espaco/${s.slug}/assinatura`);
    await logActivity(
      s,
      "subscription.change",
      `Iniciou a assinatura do plano ${plan.name} (checkout)`,
    );
    return { ok: true, redirectUrl: res.redirectUrl };
  }

  // Caminho manual (auto-gerido): troca imediata.
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
