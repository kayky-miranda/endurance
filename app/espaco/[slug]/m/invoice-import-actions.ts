"use server";

import { revalidatePath } from "next/cache";
import { getSession, canManageTeam } from "@/lib/auth";
import {
  previewInvoices,
  commitInvoices,
  type InvoiceFileInput,
  type InvoicePreviewRow,
} from "@/lib/endurance/invoice-import";

export async function previewInvoicesAction(
  files: InvoiceFileInput[],
): Promise<{ ok: boolean; error?: string; rows?: InvoicePreviewRow[] }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role))
    return { ok: false, error: "Acesso restrito a administradores." };
  const rows = await previewInvoices(s.org, (files ?? []).slice(0, 200));
  return { ok: true, rows };
}

export async function commitInvoicesAction(
  files: InvoiceFileInput[],
): Promise<{ ok: boolean; error?: string; imported?: number; skipped?: number }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role))
    return { ok: false, error: "Acesso restrito a administradores." };
  const res = await commitInvoices(s.org, (files ?? []).slice(0, 200));
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfce`);
  return res;
}
