"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { openCash, addMovement, closeCash } from "@/lib/endurance/cash";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

function brl(v: number): string {
  return `R$ ${(Number(v) || 0).toFixed(2)}`;
}

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/caixa`);
  revalidatePath(`/espaco/${slug}/m/pdv`);
}

export async function openCashAction(openingAmount: number): Promise<R> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await openCash(s.org, s.sub, openingAmount);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "cash.open", `Abriu o caixa com ${brl(openingAmount)}`);
  }
  return res;
}

export async function addMovementAction(
  type: "suprimento" | "sangria",
  amount: number,
  reason: string,
): Promise<R> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addMovement(s.org, s.sub, type, amount, reason);
  if (res.ok) {
    rev(s.slug);
    const label = type === "sangria" ? "Sangria" : "Suprimento";
    await logActivity(
      s,
      "cash.movement",
      `${label} de ${brl(amount)}${reason ? ` (${reason.trim().slice(0, 60)})` : ""}`,
    );
  }
  return res;
}

export async function closeCashAction(
  countedAmount: number,
  note: string,
): Promise<R> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await closeCash(s.org, s.sub, countedAmount, note);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "cash.close", `Fechou o caixa com ${brl(countedAmount)} contados`);
  }
  return res;
}
