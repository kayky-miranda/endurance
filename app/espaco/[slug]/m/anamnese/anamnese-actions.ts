"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { hit } from "@/lib/rate-limit";
import { consumeAiCredit } from "@/lib/endurance/ai-credits";
import { saveAnamnese, deleteAnamnese } from "@/lib/endurance/anamnese";
import { summarizeAnamnese } from "@/lib/endurance/anamnese-summary";

/** Ações da Anamnese. Gate `anamnese.manage` em toda mutação. */

export type AnamneseActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string, customerId: string) {
  revalidatePath(`/espaco/${slug}/m/anamnese/${customerId}`);
  revalidatePath(`/espaco/${slug}/m/anamnese`);
}

export async function saveAnamneseAction(payload: {
  customerId: string;
  status?: "rascunho" | "concluida";
  items: { question: string; answer?: string }[];
}): Promise<AnamneseActionResult> {
  const gate = await requirePermission("anamnese.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await saveAnamnese(
    s.org,
    { id: s.sub, name: s.name },
    payload,
  );
  if (!res.ok) return res;
  await logActivity(
    s,
    "anamnese.save",
    `Salvou a anamnese de um paciente (${payload.status ?? "rascunho"})`,
    payload.customerId,
  );
  revalidate(s.slug, payload.customerId);
  return { ok: true, id: res.id };
}

export async function deleteAnamneseAction(payload: {
  customerId: string;
}): Promise<AnamneseActionResult> {
  const gate = await requirePermission("anamnese.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteAnamnese(s.org, payload.customerId);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "anamnese.delete", "Removeu uma anamnese", payload.customerId);
  revalidate(s.slug, payload.customerId);
  return { ok: true };
}

export type AnamneseSummaryResult =
  | { ok: true; text: string; source: "ai" | "heuristic" }
  | { ok: false; error: string };

/**
 * Resumo da anamnese (IA opcional + fallback). Gate anamnese.manage + rate
 * limit. Resume o RASCUNHO enviado pelo cliente; nada é gravado — é apoio à
 * leitura para o profissional.
 */
export async function summarizeAnamneseAction(payload: {
  customerId: string;
  items: { question: string; answer?: string }[];
}): Promise<AnamneseSummaryResult> {
  const gate = await requirePermission("anamnese.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  if (!(await hit(`anamnese:summary:${s.sub}`, 12, 60_000)).ok)
    return { ok: false, error: "Muitos resumos seguidos. Aguarde um instante." };

  const credit = await consumeAiCredit(s.org, "anamnese_summary");
  if (!credit.ok) return { ok: false, error: credit.error! };

  const customer = await prisma.customer.findFirst({
    where: { id: payload.customerId, organizationId: s.org },
    select: { name: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  const res = await summarizeAnamnese(
    customer.name,
    payload.items.map((i) => ({ question: i.question, answer: i.answer ?? "" })),
  );
  await logActivity(s, "anamnese.summary", "Gerou resumo da anamnese", payload.customerId);
  return { ok: true, text: res.text, source: res.source };
}

export interface PatientHit {
  id: string;
  name: string;
  phone: string;
}

export async function searchPatientsAction(term: string): Promise<PatientHit[]> {
  const gate = await requirePermission("anamnese.manage");
  if (!gate.ok) return [];
  const q = term.trim();
  if (q.length < 2) return [];
  const rows = await prisma.customer.findMany({
    where: {
      organizationId: gate.session.org,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone }));
}
