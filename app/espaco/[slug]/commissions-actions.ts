"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { setCommissionPercent } from "@/lib/endurance/commissions";

/** Configuração de comissão — gate settings.general (é config de gestão). */

export type CommissionActionResult = { ok: true } | { ok: false; error: string };

export async function setCommissionPercentAction(
  userId: string,
  percent: number,
): Promise<CommissionActionResult> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setCommissionPercent(s.org, userId, Number(percent));
  if (!res.ok) return res;
  await logActivity(s, "commission.set", `Definiu comissão de ${percent}% para um profissional`, userId);
  revalidatePath(`/espaco/${s.slug}`);
  return { ok: true };
}
