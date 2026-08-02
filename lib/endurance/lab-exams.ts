import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  classifyExam,
  compareWithPrevious,
  formatRange,
  type ExamFlag,
  type ExamTrend,
} from "./lab-exam-rules";

/**
 * Exames laboratoriais do paciente. Cada resultado guarda a FAIXA DE REFERÊNCIA
 * do próprio laudo, e é ela que sustenta a sinalização de "alterado" — sem
 * conhecimento médico embutido e sem IA. Exclusão é lógica (dado clínico).
 */

export interface LabExamRow {
  id: string;
  name: string;
  panel: string;
  value: number;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  rangeLabel: string;
  collectedAt: string;
  notes: string;
  createdByName: string;
  flag: ExamFlag;
  severe: boolean;
  /** Comparação com o resultado anterior do mesmo analito. */
  trend: ExamTrend;
  delta: number;
}

export interface LabExamsView {
  exams: LabExamRow[];
  alteredCount: number;
  severeCount: number;
  lastCollectedAt: string | null;
}

const dec = (v: unknown): number | null =>
  v === null || v === undefined ? null : money(v as never);

/**
 * Resultados do paciente, do mais recente para o mais antigo, já classificados
 * e comparados com o exame anterior de mesmo nome.
 */
export async function getPatientExams(
  org: string,
  customerId: string,
  limit = 60,
): Promise<LabExamsView> {
  const rows = await prisma.labExam.findMany({
    where: { organizationId: org, customerId },
    orderBy: { collectedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      panel: true,
      value: true,
      unit: true,
      refMin: true,
      refMax: true,
      collectedAt: true,
      notes: true,
      createdByName: true,
    },
  });

  // Para comparar com "o anterior", percorremos do mais ANTIGO para o mais
  // recente guardando o último valor visto de cada analito.
  const previousByName = new Map<string, number>();
  const ascending = [...rows].reverse();
  const trendById = new Map<string, { trend: ExamTrend; delta: number }>();
  for (const r of ascending) {
    const value = money(r.value);
    const key = r.name.trim().toLowerCase();
    trendById.set(r.id, compareWithPrevious(value, previousByName.get(key) ?? null));
    previousByName.set(key, value);
  }

  const exams: LabExamRow[] = rows.map((r) => {
    const value = money(r.value);
    const refMin = dec(r.refMin);
    const refMax = dec(r.refMax);
    const c = classifyExam(value, { refMin, refMax });
    const t = trendById.get(r.id) ?? { trend: "primeiro" as ExamTrend, delta: 0 };
    return {
      id: r.id,
      name: r.name,
      panel: r.panel,
      value,
      unit: r.unit,
      refMin,
      refMax,
      rangeLabel: formatRange({ refMin, refMax }, r.unit),
      collectedAt: r.collectedAt.toISOString(),
      notes: r.notes,
      createdByName: r.createdByName,
      flag: c.flag,
      severe: c.severe,
      trend: t.trend,
      delta: t.delta,
    };
  });

  const altered = exams.filter((e) => e.flag === "alto" || e.flag === "baixo");
  return {
    exams,
    alteredCount: altered.length,
    severeCount: altered.filter((e) => e.severe).length,
    lastCollectedAt: exams[0]?.collectedAt ?? null,
  };
}

export type LabExamResult = { ok: true; id: string } | { ok: false; error: string };

export interface LabExamInput {
  customerId: string;
  name: string;
  panel?: string;
  value: number;
  unit?: string;
  refMin?: number | null;
  refMax?: number | null;
  collectedAt: string; // YYYY-MM-DD
  notes?: string;
}

const parseDate = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

function validate(input: LabExamInput): string | null {
  if (!input.name?.trim()) return "Informe o nome do exame.";
  if (!Number.isFinite(input.value)) return "Valor do resultado inválido.";
  const at = parseDate(input.collectedAt);
  if (!at) return "Data da coleta inválida.";
  if (at.getTime() > Date.now() + 86_400_000)
    return "A data da coleta não pode estar no futuro.";
  const { refMin, refMax } = input;
  if (
    typeof refMin === "number" &&
    typeof refMax === "number" &&
    refMin > refMax
  )
    return "A referência mínima não pode ser maior que a máxima.";
  return null;
}

export async function createLabExam(
  org: string,
  actor: { id: string; name: string },
  input: LabExamInput,
): Promise<LabExamResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  const created = await prisma.labExam.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      name: input.name.trim().slice(0, 120),
      panel: (input.panel ?? "").trim().slice(0, 80),
      value: input.value,
      unit: (input.unit ?? "").trim().slice(0, 20),
      refMin: typeof input.refMin === "number" ? input.refMin : null,
      refMax: typeof input.refMax === "number" ? input.refMax : null,
      collectedAt: parseDate(input.collectedAt) as Date,
      notes: (input.notes ?? "").trim().slice(0, 500),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/** Exclusão LÓGICA — resultado de exame é registro clínico. */
export async function deleteLabExam(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.labExam.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Exame não encontrado." };
  await prisma.labExam.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
