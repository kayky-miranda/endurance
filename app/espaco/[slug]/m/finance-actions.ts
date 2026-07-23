"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  markEntryPaid,
  createEntry,
  type NewEntryInput,
} from "@/lib/endurance/finance";
import { markReconciled } from "@/lib/endurance/reconciliation";
import {
  buildOfxPreview,
  applyOfxReconciliation,
} from "@/lib/endurance/ofx-reconcile";
import { logActivity } from "@/lib/endurance/activity-log";
import { FinanceEntrySchema, firstError } from "@/lib/validation";

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

  const parsed = FinanceEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  const res = await createEntry(s.org, data);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    const kind = data.kind === "pagar" ? "a pagar" : "a receber";
    await logActivity(
      s,
      "finance.entry_create",
      `Criou lançamento ${kind} "${data.description.slice(0, 60)}" (${brl(data.amount)})`,
    );
  }
  return res;
}

/** Prévia de conciliação a partir do conteúdo de um arquivo OFX. */
export async function previewOfxAction(
  content: string,
): Promise<
  | { ok: true; preview: import("@/lib/endurance/ofx-reconcile").OfxPreview }
  | { ok: false; error: string }
> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  if (!content || content.length > 5_000_000)
    return { ok: false, error: "Arquivo OFX inválido ou grande demais." };
  try {
    const preview = await buildOfxPreview(s.org, content);
    if (preview.total === 0)
      return { ok: false, error: "Nenhuma transação encontrada no arquivo OFX." };
    return { ok: true, preview };
  } catch {
    return { ok: false, error: "Não foi possível ler o arquivo OFX." };
  }
}

/** Efetiva as conciliações confirmadas (fitid ↔ lançamento). */
export async function applyOfxAction(
  pairs: { fitid: string; entryId: string }[],
): Promise<{ ok: boolean; reconciled?: number; error?: string }> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  const res = await applyOfxReconciliation(s.org, pairs);
  if (res.ok) {
    await logActivity(
      s,
      "finance.ofx_reconcile",
      `Conciliou ${res.reconciled} lançamento(s) via OFX`,
    );
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  }
  return res;
}
