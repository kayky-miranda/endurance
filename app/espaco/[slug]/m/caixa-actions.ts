"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { openCash, addMovement, closeCash } from "@/lib/endurance/cash";

type R = { ok: boolean; error?: string };

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/caixa`);
  revalidatePath(`/espaco/${slug}/m/pdv`);
}

export async function openCashAction(openingAmount: number): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  const res = await openCash(s.org, s.sub, openingAmount);
  if (res.ok) rev(s.slug);
  return res;
}

export async function addMovementAction(
  type: "suprimento" | "sangria",
  amount: number,
  reason: string,
): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  const res = await addMovement(s.org, s.sub, type, amount, reason);
  if (res.ok) rev(s.slug);
  return res;
}

export async function closeCashAction(
  countedAmount: number,
  note: string,
): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  const res = await closeCash(s.org, s.sub, countedAmount, note);
  if (res.ok) rev(s.slug);
  return res;
}
