"use server";

import { revalidatePath } from "next/cache";
import { getSession, sessionHasPermission } from "@/lib/auth";
import { emitNfe } from "@/lib/endurance/nfe-service";
import { cancelNfce } from "@/lib/endurance/fiscal-service";

export async function emitNfeAction(
  saleId: string,
): Promise<{ ok: boolean; error?: string; docId?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!sessionHasPermission(s, "fiscal.manage"))
    return { ok: false, error: "Sem permissão para emitir notas fiscais." };
  const res = await emitNfe(s.org, saleId);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfe`);
  return res.ok ? { ok: true, docId: res.docId } : { ok: false, error: res.error };
}

export async function cancelNfeAction(
  docId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!sessionHasPermission(s, "fiscal.manage"))
    return { ok: false, error: "Sem permissão para cancelar notas fiscais." };
  const res = await cancelNfce(s.org, docId, motivo);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfe`);
  return res;
}
