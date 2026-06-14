"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  markEntryPaid,
  createEntry,
  type NewEntryInput,
} from "@/lib/endurance/finance";
import { markReconciled } from "@/lib/endurance/reconciliation";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

function brl(v: number): string {
  return `R$ ${(Number(v) || 0).toFixed(2)}`;
}

export async function markPaidAction(id: string): Promise<R> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await markEntryPaid(s.org, id);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(s, "finance.entry_paid", "Deu baixa em lançamento financeiro", id);
  }
  return res;
}

/** Concilia manualmente uma cobrança PIX (ex.: PIX pago sem venda tratado à parte). */
export async function markReconciledAction(chargeId: string): Promise<R> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await markReconciled(s.org, chargeId);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(s, "finance.pix_reconciled", "Conciliou cobrança PIX", chargeId);
  }
  return res;
}

export async function createEntryAction(input: NewEntryInput): Promise<R> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createEntry(s.org, input);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    const kind = input.kind === "pagar" ? "a pagar" : "a receber";
    await logActivity(
      s,
      "finance.entry_create",
      `Criou lançamento ${kind} "${(input.description ?? "").trim().slice(0, 60)}" (${brl(input.amount)})`,
    );
  }
  return res;
}
