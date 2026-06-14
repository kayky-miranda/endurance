"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  previewInvoices,
  commitInvoices,
  type InvoiceFileInput,
  type InvoicePreviewRow,
  type CommitOptions,
  type CommitInvoicesResult,
} from "@/lib/endurance/invoice-import";
import { logActivity } from "@/lib/endurance/activity-log";

export async function previewInvoicesAction(
  files: InvoiceFileInput[],
): Promise<{ ok: boolean; error?: string; rows?: InvoicePreviewRow[] }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const rows = await previewInvoices(gate.session.org, (files ?? []).slice(0, 200));
  return { ok: true, rows };
}

export async function commitInvoicesAction(
  files: InvoiceFileInput[],
  options?: CommitOptions,
): Promise<CommitInvoicesResult | { ok: false; error: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await commitInvoices(s.org, (files ?? []).slice(0, 200), options);
  if (res.ok) {
    // A importação pode mexer em estoque/produtos/financeiro além do fiscal.
    revalidatePath(`/espaco/${s.slug}/m/nfce`);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(
      s,
      "invoice.import",
      `Importou ${res.imported} nota(s) fiscal(is) — ${res.stockUpdated} entrada(s) de estoque` +
        ` (${res.productsCreated} produto(s) novo(s)), ${res.payables} conta(s) a pagar` +
        `${res.skipped > 0 ? `, ${res.skipped} ignorada(s)` : ""}`,
    );
  }
  return res;
}
