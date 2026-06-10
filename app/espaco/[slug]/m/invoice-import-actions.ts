"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  previewInvoices,
  commitInvoices,
  type InvoiceFileInput,
  type InvoicePreviewRow,
} from "@/lib/endurance/invoice-import";

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
): Promise<{ ok: boolean; error?: string; imported?: number; skipped?: number }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await commitInvoices(s.org, (files ?? []).slice(0, 200));
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfce`);
  return res;
}
