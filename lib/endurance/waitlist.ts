import "server-only";
import { prisma } from "@/lib/db";

/**
 * Lista de espera da agenda: pacientes aguardando encaixe. Ordem de chegada
 * (FIFO). Ao agendar a partir de uma entrada, ela passa a "agendado" e sai da
 * lista. Isolada por organização; RBAC (agenda.manage) nas actions.
 */

export interface WaitlistRow {
  id: string;
  customerId: string | null;
  customerName: string;
  professionalId: string | null;
  professional: string;
  service: string;
  notes: string;
  createdAt: string; // ISO
}

function toRow(w: {
  id: string;
  customerId: string | null;
  customerName: string;
  professionalId: string | null;
  professional: string;
  service: string;
  notes: string;
  createdAt: Date;
}): WaitlistRow {
  return {
    id: w.id,
    customerId: w.customerId,
    customerName: w.customerName,
    professionalId: w.professionalId,
    professional: w.professional,
    service: w.service,
    notes: w.notes,
    createdAt: w.createdAt.toISOString(),
  };
}

/** Entradas aguardando, por ordem de chegada. */
export async function listWaitlist(org: string): Promise<WaitlistRow[]> {
  const rows = await prisma.waitlistEntry.findMany({
    where: { organizationId: org, status: "aguardando" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRow);
}

export type WaitlistResult = { ok: true; id: string } | { ok: false; error: string };

export interface WaitlistInput {
  customerId?: string | null;
  customerName?: string;
  professionalId?: string | null;
  service?: string;
  notes?: string;
}

export async function addToWaitlist(
  org: string,
  actor: { id: string; name: string },
  input: WaitlistInput,
): Promise<WaitlistResult> {
  const hasWho =
    (input.customerId && input.customerId.length > 0) ||
    (input.customerName && input.customerName.trim().length > 0);
  if (!hasWho) return { ok: false, error: "Informe o paciente." };

  // Resolve nomes (snapshot) validando posse pela org.
  let customerId: string | null = null;
  let customerName = (input.customerName ?? "").trim();
  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!c) return { ok: false, error: "Paciente não encontrado." };
    customerId = c.id;
    customerName = c.name;
  }

  let professionalId: string | null = null;
  let professional = "";
  if (input.professionalId) {
    const u = await prisma.user.findFirst({
      where: { id: input.professionalId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!u) return { ok: false, error: "Profissional não encontrado." };
    professionalId = u.id;
    professional = u.name;
  }

  const created = await prisma.waitlistEntry.create({
    data: {
      organizationId: org,
      customerId,
      customerName,
      professionalId,
      professional,
      service: (input.service ?? "").trim(),
      notes: (input.notes ?? "").trim(),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

async function setStatus(
  org: string,
  id: string,
  status: "agendado" | "removido",
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.waitlistEntry.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Entrada não encontrada." };
  await prisma.waitlistEntry.update({ where: { id }, data: { status } });
  return { ok: true };
}

/** Marca como agendado (saiu da lista ao virar consulta). */
export const markWaitlistScheduled = (org: string, id: string) =>
  setStatus(org, id, "agendado");

/** Remove da lista (desistência / não faz mais sentido). */
export const removeFromWaitlist = (org: string, id: string) =>
  setStatus(org, id, "removido");
