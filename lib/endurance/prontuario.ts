import "server-only";
import { prisma } from "@/lib/db";
import { parsePage, pageMeta, PAGE_SIZE, type PageMeta } from "./pagination";

/**
 * Prontuário clínico: anotações confidenciais do paciente. Serve os nichos de
 * saúde (nutrição, psicologia, clínica). Cada anotação é SEMPRE de um Customer
 * (paciente) e pode citar o atendimento de origem. Exclusão é lógica — nada
 * some do histórico clínico.
 *
 * Isolamento por organização em toda operação; o RBAC (prontuario.manage) é
 * aplicado na camada de actions/página.
 */

export interface PatientRow {
  id: string;
  name: string;
  phone: string;
  notes: number;
  lastNote: string | null; // ISO
}

export interface ClinicalNoteRow {
  id: string;
  title: string;
  content: string;
  authorName: string;
  appointmentId: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  edited: boolean;
}

export interface PatientRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  notes: ClinicalNoteRow[];
}

function toNoteRow(n: {
  id: string;
  title: string;
  content: string;
  authorName: string;
  appointmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
}): ClinicalNoteRow {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    authorName: n.authorName,
    appointmentId: n.appointmentId,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    edited: n.editedAt !== null,
  };
}

/** Pacientes que já têm prontuário (ou busca por nome/telefone). */
export async function listPatients(
  org: string,
  opts: { page?: string; term?: string } = {},
): Promise<{ patients: PatientRow[]; total: number; meta: PageMeta }> {
  const page = parsePage(opts.page);
  const perPage = PAGE_SIZE;
  const term = (opts.term ?? "").trim();

  // Base: clientes com ao menos uma anotação. A busca amplia para qualquer
  // cliente (para iniciar um prontuário novo a partir do cadastro).
  const noteGroups = await prisma.clinicalNote.groupBy({
    by: ["customerId"],
    where: { organizationId: org },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const withNotes = new Map(
    noteGroups.map((g) => [
      g.customerId,
      { count: g._count._all, last: g._max.createdAt },
    ]),
  );

  const where = term
    ? {
        organizationId: org,
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          { phone: { contains: term } },
        ],
      }
    : { organizationId: org, id: { in: [...withNotes.keys()] } };

  const ids = [...withNotes.keys()];
  if (!term && ids.length === 0) {
    return { patients: [], total: 0, meta: pageMeta(page, 0) };
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const patients: PatientRow[] = customers.map((c) => {
    const info = withNotes.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: info?.count ?? 0,
      lastNote: info?.last ? info.last.toISOString() : null,
    };
  });

  return { patients, total, meta: pageMeta(page, total) };
}

/** Prontuário completo de um paciente (dados + timeline de anotações). */
export async function getPatientRecord(
  org: string,
  customerId: string,
): Promise<PatientRecord | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { id: true, name: true, phone: true, email: true, document: true },
  });
  if (!customer) return null;

  const notes = await prisma.clinicalNote.findMany({
    where: { organizationId: org, customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      authorName: true,
      appointmentId: true,
      createdAt: true,
      updatedAt: true,
      editedAt: true,
    },
  });

  return { ...customer, notes: notes.map(toNoteRow) };
}

export type NoteResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface NoteInput {
  customerId: string;
  appointmentId?: string | null;
  title?: string;
  content: string;
}

function validateNote(input: NoteInput): string | null {
  if (!input.customerId) return "Paciente é obrigatório.";
  if (!input.content || input.content.trim().length < 1)
    return "A anotação não pode ficar vazia.";
  if (input.content.length > 20000) return "Anotação muito longa.";
  return null;
}

export async function createNote(
  org: string,
  actor: { id: string; name: string },
  input: NoteInput,
): Promise<NoteResult> {
  const invalid = validateNote(input);
  if (invalid) return { ok: false, error: invalid };

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  // Se veio de um atendimento, valida que é da mesma org e do mesmo paciente.
  let appointmentId: string | null = null;
  if (input.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, organizationId: org },
      select: { id: true, customerId: true },
    });
    if (appt && appt.customerId === input.customerId) appointmentId = appt.id;
  }

  const created = await prisma.clinicalNote.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      appointmentId,
      authorId: actor.id,
      authorName: actor.name,
      title: (input.title ?? "").trim(),
      content: input.content.trim(),
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateNote(
  org: string,
  id: string,
  input: { title?: string; content: string },
): Promise<NoteResult> {
  if (!input.content || input.content.trim().length < 1)
    return { ok: false, error: "A anotação não pode ficar vazia." };
  if (input.content.length > 20000)
    return { ok: false, error: "Anotação muito longa." };

  const existing = await prisma.clinicalNote.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Anotação não encontrada." };

  await prisma.clinicalNote.update({
    where: { id },
    data: {
      title: (input.title ?? "").trim(),
      content: input.content.trim(),
      editedAt: new Date(),
    },
  });
  return { ok: true, id };
}

/** Exclusão LÓGICA — preserva o histórico clínico (retenção legal). */
export async function deleteNote(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.clinicalNote.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Anotação não encontrada." };
  await prisma.clinicalNote.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
