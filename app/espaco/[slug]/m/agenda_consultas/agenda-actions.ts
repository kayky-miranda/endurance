"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
  deleteAppointment,
  createRecurringSeries,
  rescheduleAppointment,
  type AppointmentRow,
} from "@/lib/endurance/agenda";
import {
  STATUS_LABEL,
  recurrenceDates,
  isValidRecurrenceFreq,
  type AppointmentStatus,
} from "@/lib/endurance/scheduling";
import { createBlock, deleteBlock } from "@/lib/endurance/schedule-blocks";
import { blockKindLabel } from "@/lib/endurance/schedule-block";
import { getWorkspace } from "@/lib/endurance/workspace";
import { buildConfirmationMessage, waLink } from "@/lib/endurance/appointment-message";

/**
 * Ações da Agenda de atendimentos. Toda mutação abre com o gate de
 * `agenda.manage`; a busca de cliente exige só sessão (leitura da própria org).
 */

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; conflict?: AppointmentRow };

interface FormPayload {
  id?: string;
  customerId?: string | null;
  customerName?: string;
  professionalId?: string | null;
  service?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMin: number;
  price?: number;
  notes?: string;
}

/** Combina data + hora locais em um Date (o servidor roda no fuso do deploy). */
function combine(date: string, time: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!dm || !tm) return new Date(NaN);
  return new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    0,
    0,
  );
}

function revalidate(slug: string) {
  revalidatePath(`/espaco/${slug}/m/agenda_consultas`);
}

export async function saveAppointmentAction(
  payload: FormPayload,
): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const input = {
    customerId: payload.customerId ?? null,
    customerName: payload.customerName,
    professionalId: payload.professionalId ?? null,
    service: payload.service,
    startsAt: combine(payload.date, payload.time),
    durationMin: Number(payload.durationMin) || 30,
    price: Number(payload.price) || 0,
    notes: payload.notes,
  };

  const res = payload.id
    ? await updateAppointment(s.org, payload.id, input)
    : await createAppointment(s.org, { id: s.sub, name: s.name }, input);

  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "appointment.update" : "appointment.create",
    `${payload.id ? "Editou" : "Agendou"} atendimento de ${
      input.customerName || "cliente"
    } em ${payload.date} ${payload.time}`,
    res.id,
  );
  revalidate(s.slug);
  return { ok: true, id: res.id };
}

export async function setAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setAppointmentStatus(s.org, id, status);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao atualizar." };
  await logActivity(
    s,
    "appointment.status",
    `Marcou atendimento como ${STATUS_LABEL[status] ?? status}`,
    id,
  );
  revalidate(s.slug);
  return { ok: true, id };
}

export async function deleteAppointmentAction(
  id: string,
): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteAppointment(s.org, id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao excluir." };
  await logActivity(s, "appointment.delete", "Excluiu um atendimento", id);
  revalidate(s.slug);
  return { ok: true };
}

export interface CustomerHit {
  id: string;
  name: string;
  phone: string;
}

/** Busca clientes/pacientes por nome ou telefone para o seletor da agenda. */
export async function searchCustomersAction(
  term: string,
): Promise<CustomerHit[]> {
  const gate = await requirePermission("agenda.manage");
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

// ---- Bloqueios de agenda ----

function combineDT(date: string, time: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!dm) return new Date(NaN);
  return new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    tm ? Number(tm[1]) : 0,
    tm ? Number(tm[2]) : 0,
    0,
    0,
  );
}

export async function createBlockAction(payload: {
  professionalId?: string | null;
  kind?: string;
  reason?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createBlock(
    s.org,
    { id: s.sub, name: s.name },
    {
      professionalId: payload.professionalId ?? null,
      kind: payload.kind,
      reason: payload.reason,
      startsAt: combineDT(payload.startDate, payload.startTime),
      endsAt: combineDT(payload.endDate, payload.endTime),
    },
  );
  if (!res.ok) return res;
  await logActivity(
    s,
    "agenda.block.create",
    `Criou bloqueio de agenda (${blockKindLabel(payload.kind ?? "bloqueio")})`,
    res.id,
  );
  revalidate(s.slug);
  return { ok: true, id: res.id };
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteBlock(s.org, id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao remover." };
  await logActivity(s, "agenda.block.delete", "Removeu um bloqueio de agenda", id);
  revalidate(s.slug);
  return { ok: true };
}

export type SeriesActionResult =
  | { ok: true; created: number; skipped: { date: string; reason: string }[] }
  | { ok: false; error: string };

/** Cria uma série recorrente de atendimentos (semanal/quinzenal/mensal). */
export async function createSeriesAction(
  payload: FormPayload & { freq: string; count: number },
): Promise<SeriesActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  if (!isValidRecurrenceFreq(payload.freq))
    return { ok: false, error: "Frequência inválida." };

  const start = combine(payload.date, payload.time);
  if (isNaN(start.getTime())) return { ok: false, error: "Data e hora inválidas." };

  const dates = recurrenceDates(start, payload.freq, Number(payload.count) || 1);
  const res = await createRecurringSeries(
    s.org,
    { id: s.sub, name: s.name },
    {
      customerId: payload.customerId ?? null,
      customerName: payload.customerName,
      professionalId: payload.professionalId ?? null,
      service: payload.service,
      startsAt: start,
      durationMin: Number(payload.durationMin) || 30,
      price: Number(payload.price) || 0,
      notes: payload.notes,
    },
    dates,
  );
  if (!res.ok) return res;
  await logActivity(
    s,
    "appointment.series",
    `Criou serie recorrente (${res.created}x) de ${payload.customerName || "cliente"}`,
  );
  revalidate(s.slug);
  return { ok: true, created: res.created, skipped: res.skipped };
}

/** Reagenda (arrastar): move só o horário, mantendo o resto. */
export async function rescheduleAction(
  id: string,
  date: string,
  time: string,
): Promise<ActionResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const newStart = combine(date, time);
  if (isNaN(newStart.getTime())) return { ok: false, error: "Horário inválido." };
  const res = await rescheduleAppointment(s.org, id, newStart);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao remarcar." };
  await logActivity(s, "appointment.reschedule", `Remarcou atendimento para ${date} ${time}`, id);
  revalidate(s.slug);
  return { ok: true, id };
}

export type WhatsAppConfirmResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Handoff de confirmação de consulta por WhatsApp: monta a mensagem e devolve a
 * URL wa.me para o cliente abrir (1 clique). NÃO envia sozinho nem altera o
 * status — é comunicação; a recepção marca "confirmado" depois. Gate
 * agenda.manage; exige paciente vinculado ao cadastro com telefone válido.
 */
export async function confirmByWhatsappAction(
  appointmentId: string,
): Promise<WhatsAppConfirmResult> {
  const gate = await requirePermission("agenda.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: s.org },
    select: {
      customerId: true,
      customerName: true,
      service: true,
      professional: true,
      startsAt: true,
    },
  });
  if (!appt) return { ok: false, error: "Atendimento não encontrado." };
  if (!appt.customerId)
    return { ok: false, error: "Vincule o paciente ao cadastro para confirmar por WhatsApp." };

  const cust = await prisma.customer.findFirst({
    where: { id: appt.customerId, organizationId: s.org },
    select: { phone: true, name: true },
  });

  const dateLabel = appt.startsAt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const timeLabel = appt.startsAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const ws = await getWorkspace(s.slug);
  const text = buildConfirmationMessage({
    orgName: ws?.name ?? "nossa clínica",
    customerName: appt.customerName || cust?.name || "",
    service: appt.service || undefined,
    dateLabel,
    timeLabel,
    professional: appt.professional || undefined,
  });

  const url = waLink(cust?.phone ?? "", text);
  if (!url)
    return { ok: false, error: "O paciente não tem um telefone válido no cadastro." };

  await logActivity(
    s,
    "agenda.confirm_whatsapp",
    "Abriu confirmação de consulta por WhatsApp",
    appt.customerId,
  );
  return { ok: true, url };
}
