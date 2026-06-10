"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  markEntryPaid,
  createEntry,
  type NewEntryInput,
} from "@/lib/endurance/finance";

type R = { ok: boolean; error?: string };

export async function markPaidAction(id: string): Promise<R> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await markEntryPaid(s.org, id);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  return res;
}

export async function createEntryAction(input: NewEntryInput): Promise<R> {
  const gate = await requirePermission("finance.reports");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createEntry(s.org, input);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  return res;
}
