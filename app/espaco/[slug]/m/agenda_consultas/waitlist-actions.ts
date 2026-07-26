"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  addToWaitlist,
  removeFromWaitlist,
  markWaitlistScheduled,
} from "@/lib/endurance/waitlist";

/** Ações da lista de espera da agenda. Gate `agenda.manage`. */

export type WaitlistActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string) {
  revalidatePath(`/espaco/${slug}/m/agenda_consultas`);
}

export async function addWaitlistAction(payload: {
  customerId?: string | null;
  customerName?: string;
  professionalId?: string | null;
  service?: string;
  notes?: string;
}): Promise<WaitlistActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addToWaitlist(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    "waitlist.add",
    `Adicionou ${payload.customerName || "paciente"} à lista de espera`,
    res.id,
  );
  revalidate(s.slug);
  return { ok: true, id: res.id };
}

export async function removeWaitlistAction(id: string): Promise<WaitlistActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await removeFromWaitlist(s.org, id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "waitlist.remove", "Removeu uma entrada da lista de espera", id);
  revalidate(s.slug);
  return { ok: true };
}

export async function markWaitlistScheduledAction(id: string): Promise<WaitlistActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await markWaitlistScheduled(s.org, id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "waitlist.scheduled", "Agendou a partir da lista de espera", id);
  revalidate(s.slug);
  return { ok: true };
}
