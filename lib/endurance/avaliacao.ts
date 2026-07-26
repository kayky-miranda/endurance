import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { computeImc } from "./assessment";

/**
 * Avaliação física (academia): sessões datadas com medidas antropométricas.
 * Isolado por organização; RBAC (avaliacao.manage) nas actions. O progresso vem
 * de comparar avaliações ao longo do tempo.
 */

export interface AssessmentRow {
  id: string;
  assessedAt: string; // ISO
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  restingHr: number | null;
  imc: number | null;
  notes: string;
  evaluator: string;
}

export interface AssessmentPatientRow {
  id: string;
  name: string;
  count: number;
  lastAt: string | null;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : money(v as never);

function toRow(a: {
  id: string;
  assessedAt: Date;
  weightKg: unknown;
  heightCm: unknown;
  bodyFatPct: unknown;
  muscleMassKg: unknown;
  waistCm: unknown;
  hipCm: unknown;
  chestCm: unknown;
  armCm: unknown;
  thighCm: unknown;
  restingHr: number | null;
  notes: string;
  createdByName: string;
}): AssessmentRow {
  const weightKg = num(a.weightKg);
  const heightCm = num(a.heightCm);
  return {
    id: a.id,
    assessedAt: a.assessedAt.toISOString(),
    weightKg,
    heightCm,
    bodyFatPct: num(a.bodyFatPct),
    muscleMassKg: num(a.muscleMassKg),
    waistCm: num(a.waistCm),
    hipCm: num(a.hipCm),
    chestCm: num(a.chestCm),
    armCm: num(a.armCm),
    thighCm: num(a.thighCm),
    restingHr: a.restingHr,
    imc: computeImc(weightKg, heightCm),
    notes: a.notes,
    evaluator: a.createdByName,
  };
}

export async function listAssessmentPatients(
  org: string,
): Promise<AssessmentPatientRow[]> {
  const groups = await prisma.physicalAssessment.groupBy({
    by: ["customerId"],
    where: { organizationId: org },
    _count: { _all: true },
    _max: { assessedAt: true },
  });
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.customerId);
  const customers = await prisma.customer.findMany({
    where: { organizationId: org, id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  return groups
    .filter((g) => nameById.has(g.customerId))
    .map((g) => ({
      id: g.customerId,
      name: nameById.get(g.customerId) as string,
      count: g._count._all,
      lastAt: g._max.assessedAt ? g._max.assessedAt.toISOString() : null,
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

/** Avaliações de um aluno, mais recentes primeiro. */
export async function getPatientAssessments(
  org: string,
  customerId: string,
): Promise<{ patientExists: boolean; assessments: AssessmentRow[] }> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { patientExists: false, assessments: [] };

  const rows = await prisma.physicalAssessment.findMany({
    where: { organizationId: org, customerId },
    orderBy: { assessedAt: "desc" },
  });
  return { patientExists: true, assessments: rows.map(toRow) };
}

export type AssessmentResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface AssessmentInput {
  customerId: string;
  assessedAt: Date;
  weightKg?: number | null;
  heightCm?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  restingHr?: number | null;
  notes?: string;
}

const MEASURE_KEYS = [
  "weightKg",
  "heightCm",
  "bodyFatPct",
  "muscleMassKg",
  "waistCm",
  "hipCm",
  "chestCm",
  "armCm",
  "thighCm",
] as const;

export async function addAssessment(
  org: string,
  actor: { id: string; name: string },
  input: AssessmentInput,
): Promise<AssessmentResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Aluno não encontrado." };
  if (!(input.assessedAt instanceof Date) || isNaN(input.assessedAt.getTime()))
    return { ok: false, error: "Data inválida." };

  // Exige ao menos uma medida — avaliação vazia não faz sentido.
  const hasAny =
    MEASURE_KEYS.some((k) => input[k] != null) || input.restingHr != null;
  if (!hasAny) return { ok: false, error: "Informe ao menos uma medida." };

  const created = await prisma.physicalAssessment.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      assessedAt: input.assessedAt,
      weightKg: input.weightKg ?? null,
      heightCm: input.heightCm ?? null,
      bodyFatPct: input.bodyFatPct ?? null,
      muscleMassKg: input.muscleMassKg ?? null,
      waistCm: input.waistCm ?? null,
      hipCm: input.hipCm ?? null,
      chestCm: input.chestCm ?? null,
      armCm: input.armCm ?? null,
      thighCm: input.thighCm ?? null,
      restingHr: input.restingHr ?? null,
      notes: (input.notes ?? "").trim(),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function deleteAssessment(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.physicalAssessment.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Avaliação não encontrada." };
  await prisma.physicalAssessment.delete({ where: { id } });
  return { ok: true };
}
