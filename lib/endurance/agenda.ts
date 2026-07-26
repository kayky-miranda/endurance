import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  type AppointmentStatus,
  isValidStatus,
  isBlockingStatus,
  canTransition,
  overlaps,
  dayRange,
} from "./scheduling";
import { findBlockConflict } from "./schedule-blocks";
import { createReceivableForAppointment } from "./finance";

/** Mensagem de erro padrão quando o horário cai sobre um bloqueio de agenda. */
function blockError(block: { kindLabel: string; reason: string }): string {
  return `Horário indisponível: ${block.kindLabel}${block.reason ? ` — ${block.reason}` : ""}.`;
}

/**
 * Agenda de atendimentos: consultas, sessões e serviços com hora marcada.
 * Serve os nichos de serviço (nutrição, psicologia, clínica, salão) e reutiliza
 * o Customer como paciente/cliente. Toda mutação é isolada por organização e
 * passa pela detecção de conflito de horário do profissional.
 */

export interface AppointmentRow {
  id: string;
  customerId: string | null;
  customerName: string;
  professionalId: string | null;
  professional: string;
  service: string;
  startsAt: string; // ISO
  startTime: string; // HH:MM local
  endTime: string; // HH:MM local
  durationMin: number;
  status: AppointmentStatus;
  price: number;
  notes: string;
}

export interface DayAgenda {
  date: string; // YYYY-MM-DD
  appointments: AppointmentRow[];
  counts: Record<AppointmentStatus, number>;
  total: number;
  revenue: number; // soma de atendidos
}

export interface ProfessionalOption {
  id: string;
  name: string;
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function toRow(a: {
  id: string;
  customerId: string | null;
  customerName: string;
  professionalId: string | null;
  professional: string;
  service: string;
  startsAt: Date;
  durationMin: number;
  status: string;
  price: Parameters<typeof money>[0];
  notes: string;
}): AppointmentRow {
  const end = new Date(a.startsAt.getTime() + a.durationMin * 60_000);
  return {
    id: a.id,
    customerId: a.customerId,
    customerName: a.customerName,
    professionalId: a.professionalId,
    professional: a.professional,
    service: a.service,
    startsAt: a.startsAt.toISOString(),
    startTime: hhmm(a.startsAt),
    endTime: hhmm(end),
    durationMin: a.durationMin,
    status: isValidStatus(a.status) ? a.status : "agendado",
    price: money(a.price),
    notes: a.notes,
  };
}

/** Agenda de um dia (YYYY-MM-DD), ordenada por horário. */
export async function getDayAgenda(
  org: string,
  dateStr: string,
  opts: { professionalId?: string } = {},
): Promise<DayAgenda> {
  const { start, end } = dayRange(dateStr);
  const rows = await prisma.appointment.findMany({
    where: {
      organizationId: org,
      startsAt: { gte: start, lt: end },
      ...(opts.professionalId ? { professionalId: opts.professionalId } : {}),
    },
    orderBy: { startsAt: "asc" },
  });

  const appointments = rows.map(toRow);
  const counts: Record<AppointmentStatus, number> = {
    agendado: 0,
    confirmado: 0,
    atendido: 0,
    faltou: 0,
    cancelado: 0,
  };
  let revenue = 0;
  for (const a of appointments) {
    counts[a.status]++;
    if (a.status === "atendido") revenue += a.price;
  }

  return {
    date: dateStr,
    appointments,
    counts,
    total: appointments.length,
    revenue: Math.round(revenue * 100) / 100,
  };
}

/**
 * Consultas num intervalo [from, to) — base das visões de semana e mês.
 * Ordenadas por horário; opcionalmente filtradas por profissional.
 */
export async function getAgendaRange(
  org: string,
  from: Date,
  to: Date,
  opts: { professionalId?: string } = {},
): Promise<AppointmentRow[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      organizationId: org,
      startsAt: { gte: from, lt: to },
      ...(opts.professionalId ? { professionalId: opts.professionalId } : {}),
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toRow);
}

/** Profissionais disponíveis (usuários ativos da organização). */
export async function listProfessionals(
  org: string,
): Promise<ProfessionalOption[]> {
  const users = await prisma.user.findMany({
    where: { organizationId: org, status: { not: "deleted" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name }));
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; conflict?: AppointmentRow };

interface AppointmentInput {
  customerId?: string | null;
  customerName?: string;
  professionalId?: string | null;
  service?: string;
  startsAt: Date;
  durationMin: number;
  price?: number;
  notes?: string;
}

/**
 * Detecta conflito de horário do MESMO profissional. Ignora atendimentos
 * cancelados e o próprio registro (ao editar). Sem profissional definido não
 * há conflito (agenda "avulsa").
 */
async function findConflict(
  org: string,
  professionalId: string | null | undefined,
  startsAt: Date,
  durationMin: number,
  excludeId?: string,
): Promise<AppointmentRow | null> {
  if (!professionalId) return null;
  // Janela ampla no mesmo dia; a sobreposição fina é decidida em memória.
  const { start, end } = dayRange(
    `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(
      startsAt.getDate(),
    ).padStart(2, "0")}`,
  );
  const sameDay = await prisma.appointment.findMany({
    where: {
      organizationId: org,
      professionalId,
      startsAt: { gte: start, lt: end },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const startMs = startsAt.getTime();
  for (const a of sameDay) {
    if (!isBlockingStatus(a.status as AppointmentStatus)) continue;
    if (overlaps(startMs, durationMin, a.startsAt.getTime(), a.durationMin)) {
      return toRow(a);
    }
  }
  return null;
}

function validate(input: AppointmentInput): string | null {
  if (!(input.startsAt instanceof Date) || isNaN(input.startsAt.getTime()))
    return "Data e hora inválidas.";
  if (!input.durationMin || input.durationMin < 5 || input.durationMin > 600)
    return "Duração inválida.";
  const hasWho =
    (input.customerId && input.customerId.length > 0) ||
    (input.customerName && input.customerName.trim().length > 0);
  if (!hasWho) return "Informe o cliente/paciente do atendimento.";
  return null;
}

/** Resolve o nome exibido do cliente (snapshot) validando a posse pela org. */
async function resolveCustomer(
  org: string,
  customerId: string | null | undefined,
  fallbackName: string | undefined,
): Promise<{ id: string | null; name: string } | { error: string }> {
  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!c) return { error: "Cliente não encontrado." };
    return { id: c.id, name: c.name };
  }
  return { id: null, name: (fallbackName ?? "").trim() };
}

async function resolveProfessional(
  org: string,
  professionalId: string | null | undefined,
): Promise<{ id: string | null; name: string } | { error: string }> {
  if (professionalId) {
    const u = await prisma.user.findFirst({
      where: { id: professionalId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!u) return { error: "Profissional não encontrado." };
    return { id: u.id, name: u.name };
  }
  return { id: null, name: "" };
}

export async function createAppointment(
  org: string,
  actor: { id: string; name: string },
  input: AppointmentInput,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const cust = await resolveCustomer(org, input.customerId, input.customerName);
  if ("error" in cust) return { ok: false, error: cust.error };
  const prof = await resolveProfessional(org, input.professionalId);
  if ("error" in prof) return { ok: false, error: prof.error };

  const conflict = await findConflict(
    org,
    prof.id,
    input.startsAt,
    input.durationMin,
  );
  if (conflict)
    return {
      ok: false,
      error: `Conflito de horário com ${conflict.customerName || "outro atendimento"} (${conflict.startTime}–${conflict.endTime}).`,
      conflict,
    };

  const block = await findBlockConflict(org, prof.id, input.startsAt, input.durationMin);
  if (block) return { ok: false, error: blockError(block) };

  const created = await prisma.appointment.create({
    data: {
      organizationId: org,
      customerId: cust.id,
      customerName: cust.name,
      professionalId: prof.id,
      professional: prof.name,
      service: (input.service ?? "").trim(),
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      price: input.price ?? 0,
      notes: (input.notes ?? "").trim(),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export interface SeriesResult {
  ok: true;
  seriesId: string;
  created: number;
  skipped: { date: string; reason: string }[];
}

/**
 * Cria uma SÉRIE recorrente de atendimentos. Resolve cliente/profissional uma
 * vez, gera as datas e materializa cada ocorrência que NÃO conflita (com outro
 * atendimento ou bloqueio). As que conflitam são puladas e reportadas — a série
 * nunca cria em cima de um horário ocupado. Precisa de ao menos uma criada.
 */
export async function createRecurringSeries(
  org: string,
  actor: { id: string; name: string },
  input: AppointmentInput,
  dates: Date[],
): Promise<SeriesResult | { ok: false; error: string }> {
  const invalid = validate({ ...input, startsAt: dates[0] ?? input.startsAt });
  if (invalid) return { ok: false, error: invalid };
  if (dates.length === 0) return { ok: false, error: "Nenhuma data na série." };

  const cust = await resolveCustomer(org, input.customerId, input.customerName);
  if ("error" in cust) return { ok: false, error: cust.error };
  const prof = await resolveProfessional(org, input.professionalId);
  if ("error" in prof) return { ok: false, error: prof.error };

  const seriesId = randomUUID();
  const skipped: { date: string; reason: string }[] = [];
  let created = 0;

  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  for (const startsAt of dates) {
    const conflict = await findConflict(org, prof.id, startsAt, input.durationMin);
    if (conflict) {
      skipped.push({ date: fmt(startsAt), reason: `ocupado (${conflict.startTime})` });
      continue;
    }
    const block = await findBlockConflict(org, prof.id, startsAt, input.durationMin);
    if (block) {
      skipped.push({ date: fmt(startsAt), reason: block.kindLabel.toLowerCase() });
      continue;
    }
    await prisma.appointment.create({
      data: {
        organizationId: org,
        customerId: cust.id,
        customerName: cust.name,
        professionalId: prof.id,
        professional: prof.name,
        service: (input.service ?? "").trim(),
        startsAt,
        durationMin: input.durationMin,
        price: input.price ?? 0,
        notes: (input.notes ?? "").trim(),
        seriesId,
        createdById: actor.id,
        createdByName: actor.name,
      },
    });
    created++;
  }

  if (created === 0)
    return { ok: false, error: "Todos os horários da série estão ocupados ou bloqueados." };
  return { ok: true, seriesId, created, skipped };
}

export async function updateAppointment(
  org: string,
  id: string,
  input: AppointmentInput,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: org },
  });
  if (!existing) return { ok: false, error: "Atendimento não encontrado." };

  const cust = await resolveCustomer(org, input.customerId, input.customerName);
  if ("error" in cust) return { ok: false, error: cust.error };
  const prof = await resolveProfessional(org, input.professionalId);
  if ("error" in prof) return { ok: false, error: prof.error };

  const conflict = await findConflict(
    org,
    prof.id,
    input.startsAt,
    input.durationMin,
    id,
  );
  if (conflict)
    return {
      ok: false,
      error: `Conflito de horário com ${conflict.customerName || "outro atendimento"} (${conflict.startTime}–${conflict.endTime}).`,
      conflict,
    };

  const block = await findBlockConflict(org, prof.id, input.startsAt, input.durationMin);
  if (block) return { ok: false, error: blockError(block) };

  await prisma.appointment.update({
    where: { id },
    data: {
      customerId: cust.id,
      customerName: cust.name,
      professionalId: prof.id,
      professional: prof.name,
      service: (input.service ?? "").trim(),
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      price: input.price ?? 0,
      notes: (input.notes ?? "").trim(),
    },
  });
  return { ok: true, id };
}

export async function setAppointmentStatus(
  org: string,
  id: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidStatus(status)) return { ok: false, error: "Status inválido." };
  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: org },
    select: { id: true, status: true, price: true, customerName: true, startsAt: true },
  });
  if (!existing) return { ok: false, error: "Atendimento não encontrado." };
  const from = isValidStatus(existing.status) ? existing.status : "agendado";
  if (!canTransition(from, status))
    return {
      ok: false,
      error: `Não é possível mudar de "${from}" para "${status}".`,
    };
  await prisma.appointment.update({ where: { id }, data: { status } });

  // Consulta ATENDIDA gera receita no financeiro da clínica (idempotente).
  if (status === "atendido") {
    const price = money(existing.price);
    if (price > 0) {
      await createReceivableForAppointment({
        organizationId: org,
        appointmentId: id,
        amount: price,
        patientName: existing.customerName,
        when: existing.startsAt,
      });
    }
  }
  return { ok: true };
}

/**
 * Reagenda um atendimento movendo apenas o horário (arrastar no calendário),
 * mantendo cliente/profissional/duração. Passa pela mesma detecção de conflito
 * (outro atendimento e bloqueio). Estados finais não se movem.
 */
export async function rescheduleAppointment(
  org: string,
  id: string,
  newStartsAt: Date,
): Promise<{ ok: boolean; error?: string }> {
  if (!(newStartsAt instanceof Date) || isNaN(newStartsAt.getTime()))
    return { ok: false, error: "Horário inválido." };
  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: org },
  });
  if (!existing) return { ok: false, error: "Atendimento não encontrado." };
  const status = isValidStatus(existing.status) ? existing.status : "agendado";
  if (status === "atendido" || status === "cancelado")
    return { ok: false, error: "Atendimentos concluídos ou cancelados não podem ser remarcados." };

  const conflict = await findConflict(org, existing.professionalId, newStartsAt, existing.durationMin, id);
  if (conflict)
    return {
      ok: false,
      error: `Conflito com ${conflict.customerName || "outro atendimento"} (${conflict.startTime}–${conflict.endTime}).`,
    };
  const block = await findBlockConflict(org, existing.professionalId, newStartsAt, existing.durationMin);
  if (block) return { ok: false, error: blockError(block) };

  await prisma.appointment.update({ where: { id }, data: { startsAt: newStartsAt } });
  return { ok: true };
}

export async function deleteAppointment(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Atendimento não encontrado." };
  await prisma.appointment.delete({ where: { id } });
  return { ok: true };
}
