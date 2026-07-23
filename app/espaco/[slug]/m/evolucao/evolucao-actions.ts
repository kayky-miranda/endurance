"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { addMeasurement, deleteMeasurement } from "@/lib/endurance/evolucao";

/**
 * Ações da Evolução do paciente. Gate `evolucao.manage`; a busca de paciente
 * exige só a mesma permissão (leitura da própria org).
 */

export type EvolucaoResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function combine(date: string, time: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!dm) return new Date(NaN);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  const h = tm ? Number(tm[1]) : 12;
  const min = tm ? Number(tm[2]) : 0;
  return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, min, 0, 0);
}

export async function addMeasurementAction(payload: {
  customerId: string;
  metric: string;
  label?: string;
  value: number;
  unit?: string;
  date: string;
  time?: string;
  notes?: string;
}): Promise<EvolucaoResult> {
  const gate = await requirePermission("evolucao.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addMeasurement(
    s.org,
    { id: s.sub, name: s.name },
    {
      customerId: payload.customerId,
      metric: payload.metric,
      label: payload.label,
      value: Number(payload.value),
      unit: payload.unit,
      measuredAt: combine(payload.date, payload.time ?? ""),
      notes: payload.notes,
    },
  );
  if (!res.ok) return res;
  await logActivity(
    s,
    "metric.add",
    `Registrou medição (${payload.metric}) de um paciente`,
    payload.customerId,
  );
  revalidatePath(`/espaco/${s.slug}/m/evolucao/${payload.customerId}`);
  return { ok: true, id: res.id };
}

export async function deleteMeasurementAction(payload: {
  id: string;
  customerId: string;
}): Promise<EvolucaoResult> {
  const gate = await requirePermission("evolucao.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteMeasurement(s.org, payload.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao excluir." };
  await logActivity(s, "metric.delete", "Removeu uma medição", payload.customerId);
  revalidatePath(`/espaco/${s.slug}/m/evolucao/${payload.customerId}`);
  return { ok: true };
}

export interface PatientHit {
  id: string;
  name: string;
  phone: string;
}

export async function searchPatientsAction(term: string): Promise<PatientHit[]> {
  const gate = await requirePermission("evolucao.manage");
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
