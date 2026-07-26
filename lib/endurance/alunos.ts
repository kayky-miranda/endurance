import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { parsePage, pageMeta, PAGE_SIZE, type PageMeta } from "./pagination";
import { isValidStudentStatus, type StudentStatus } from "./students";

/**
 * Cadastro de alunos (academia). O aluno é um Customer (a pessoa) + um
 * StudentProfile 1:1 com os dados de matrícula. Isolado por organização;
 * RBAC (alunos.manage) nas actions.
 */

export interface StudentRow {
  id: string; // customerId
  name: string;
  phone: string;
  status: StudentStatus;
  plan: string;
  monthlyFee: number;
}

export interface StudentDetail extends StudentRow {
  email: string;
  document: string;
  goal: string;
  notes: string;
  birthDate: string | null; // YYYY-MM-DD
  enrolledAt: string | null; // YYYY-MM-DD
}

const toStatus = (s: string): StudentStatus =>
  isValidStudentStatus(s) ? s : "ativo";
const dateInput = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : null;

export async function listStudents(
  org: string,
  opts: { term?: string; pagina?: string; status?: string } = {},
): Promise<{ students: StudentRow[]; total: number; meta: PageMeta; counts: Record<StudentStatus, number> }> {
  const page = parsePage(opts.pagina);
  const term = (opts.term ?? "").trim();
  const statusFilter = isValidStudentStatus(opts.status ?? "")
    ? (opts.status as StudentStatus)
    : undefined;

  const where = {
    organizationId: org,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(term
      ? {
          customer: {
            OR: [
              { name: { contains: term, mode: "insensitive" as const } },
              { phone: { contains: term } },
            ],
          },
        }
      : {}),
  };

  const [total, rows, grouped] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      orderBy: { customer: { name: "asc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        status: true,
        plan: true,
        monthlyFee: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.studentProfile.groupBy({
      by: ["status"],
      where: { organizationId: org },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<StudentStatus, number> = { ativo: 0, inativo: 0, trancado: 0 };
  for (const g of grouped) {
    if (isValidStudentStatus(g.status)) counts[g.status] = g._count._all;
  }

  return {
    students: rows.map((r) => ({
      id: r.customer.id,
      name: r.customer.name,
      phone: r.customer.phone,
      status: toStatus(r.status),
      plan: r.plan,
      monthlyFee: money(r.monthlyFee),
    })),
    total,
    meta: pageMeta(page, total),
    counts,
  };
}

export async function getStudent(
  org: string,
  customerId: string,
): Promise<StudentDetail | null> {
  const profile = await prisma.studentProfile.findFirst({
    where: { organizationId: org, customerId },
    select: {
      status: true,
      plan: true,
      monthlyFee: true,
      goal: true,
      notes: true,
      birthDate: true,
      enrolledAt: true,
      customer: {
        select: { id: true, name: true, phone: true, email: true, document: true },
      },
    },
  });
  if (!profile) return null;
  return {
    id: profile.customer.id,
    name: profile.customer.name,
    phone: profile.customer.phone,
    email: profile.customer.email,
    document: profile.customer.document,
    status: toStatus(profile.status),
    plan: profile.plan,
    monthlyFee: money(profile.monthlyFee),
    goal: profile.goal,
    notes: profile.notes,
    birthDate: dateInput(profile.birthDate),
    enrolledAt: dateInput(profile.enrolledAt),
  };
}

export type StudentResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface StudentInput {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  status?: string;
  plan?: string;
  monthlyFee?: number;
  goal?: string;
  notes?: string;
  birthDate?: string | null;
  enrolledAt?: string | null;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function validate(input: StudentInput): string | null {
  if (!input.name || !input.name.trim()) return "Nome do aluno é obrigatório.";
  if (input.monthlyFee !== undefined && input.monthlyFee < 0)
    return "Mensalidade inválida.";
  return null;
}

function profileData(input: StudentInput) {
  return {
    status: toStatus(input.status ?? "ativo"),
    plan: (input.plan ?? "").trim(),
    monthlyFee: input.monthlyFee ?? 0,
    goal: (input.goal ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    birthDate: parseDate(input.birthDate),
    enrolledAt: parseDate(input.enrolledAt),
  };
}

/** Cria o aluno: Customer (pessoa) + StudentProfile (matrícula) atômico. */
export async function createStudent(
  org: string,
  input: StudentInput,
): Promise<StudentResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const customerId = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        organizationId: org,
        name: input.name.trim(),
        phone: (input.phone ?? "").trim(),
        email: (input.email ?? "").trim(),
        document: (input.document ?? "").trim(),
      },
      select: { id: true },
    });
    await tx.studentProfile.create({
      data: { organizationId: org, customerId: customer.id, ...profileData(input) },
    });
    return customer.id;
  });
  return { ok: true, id: customerId };
}

/** Atualiza aluno existente (pessoa + matrícula). */
export async function updateStudent(
  org: string,
  customerId: string,
  input: StudentInput,
): Promise<StudentResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const profile = await prisma.studentProfile.findFirst({
    where: { organizationId: org, customerId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Aluno não encontrado." };

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: {
        name: input.name.trim(),
        phone: (input.phone ?? "").trim(),
        email: (input.email ?? "").trim(),
        document: (input.document ?? "").trim(),
      },
    }),
    prisma.studentProfile.update({
      where: { id: profile.id },
      data: profileData(input),
    }),
  ]);
  return { ok: true, id: customerId };
}

export async function setStudentStatus(
  org: string,
  customerId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidStudentStatus(status))
    return { ok: false, error: "Situação inválida." };
  const profile = await prisma.studentProfile.findFirst({
    where: { organizationId: org, customerId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Aluno não encontrado." };
  await prisma.studentProfile.update({ where: { id: profile.id }, data: { status } });
  return { ok: true };
}
