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
  type AppointmentRow,
} from "@/lib/endurance/agenda";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/endurance/scheduling";

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
