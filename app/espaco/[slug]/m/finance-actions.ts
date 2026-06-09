"use server";

import { revalidatePath } from "next/cache";
import { getSession, canManageTeam } from "@/lib/auth";
import {
  markEntryPaid,
  createEntry,
  type NewEntryInput,
} from "@/lib/endurance/finance";

type R = { ok: boolean; error?: string };

const DENIED: R = { ok: false, error: "Acesso restrito a administradores." };

export async function markPaidAction(id: string): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await markEntryPaid(s.org, id);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  return res;
}

export async function createEntryAction(input: NewEntryInput): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await createEntry(s.org, input);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  return res;
}
