import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  presetOf,
  seriesStats,
  type SeriesStats,
} from "./metrics";

/**
 * Evolução do paciente: séries de medições numéricas (peso, medidas, escalas).
 * Genérico por (metric, value, unit) para servir qualquer nicho de saúde.
 * Tudo isolado por organização; o RBAC (evolucao.manage) fica nas actions.
 */

export interface MeasurementRow {
  id: string;
  value: number;
  unit: string;
  measuredAt: string; // ISO
  notes: string;
  authorName: string;
}

export interface MetricSeries {
  metric: string;
  label: string;
  unit: string;
  decimals: number;
  higherIsBetter: boolean;
  points: { value: number; measuredAt: string }[]; // cronológico
  measurements: MeasurementRow[]; // recentes primeiro (para a tabela)
  stats: SeriesStats | null;
}

/** Todas as séries de um paciente, uma por indicador acompanhado. */
export async function getPatientEvolution(
  org: string,
  customerId: string,
): Promise<MetricSeries[] | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return null;

  const rows = await prisma.patientMetric.findMany({
    where: { organizationId: org, customerId },
    orderBy: { measuredAt: "asc" },
    select: {
      id: true,
      metric: true,
      label: true,
      value: true,
      unit: true,
      measuredAt: true,
      notes: true,
      createdByName: true,
    },
  });

  // Agrupa por indicador preservando a ordem cronológica.
  const byMetric = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byMetric.get(r.metric) ?? [];
    list.push(r);
    byMetric.set(r.metric, list);
  }

  const series: MetricSeries[] = [];
  for (const [metric, list] of byMetric) {
    const preset = presetOf(metric);
    const unit = list[list.length - 1].unit || preset?.unit || "";
    const label = preset?.label || list[list.length - 1].label || metric;
    const higherIsBetter = preset?.higherIsBetter ?? false;
    const values = list.map((r) => money(r.value));
    series.push({
      metric,
      label,
      unit,
      decimals: preset?.decimals ?? 1,
      higherIsBetter,
      points: list.map((r) => ({
        value: money(r.value),
        measuredAt: r.measuredAt.toISOString(),
      })),
      measurements: [...list].reverse().map((r) => ({
        id: r.id,
        value: money(r.value),
        unit: r.unit || unit,
        measuredAt: r.measuredAt.toISOString(),
        notes: r.notes,
        authorName: r.createdByName,
      })),
      stats: seriesStats(values, higherIsBetter),
    });
  }

  // Ordena as séries pela medição mais recente (mais ativas no topo).
  series.sort((a, b) => {
    const la = a.points[a.points.length - 1]?.measuredAt ?? "";
    const lb = b.points[b.points.length - 1]?.measuredAt ?? "";
    return lb.localeCompare(la);
  });
  return series;
}

export interface EvolutionPatientRow {
  id: string;
  name: string;
  metrics: number; // indicadores distintos acompanhados
  measurements: number;
  lastAt: string | null;
}

/** Pacientes que já têm alguma medição, com resumo do acompanhamento. */
export async function listEvolutionPatients(
  org: string,
): Promise<EvolutionPatientRow[]> {
  const groups = await prisma.patientMetric.groupBy({
    by: ["customerId"],
    where: { organizationId: org },
    _count: { _all: true },
    _max: { measuredAt: true },
  });
  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.customerId);
  // Indicadores distintos por paciente (2ª agregação).
  const metricGroups = await prisma.patientMetric.groupBy({
    by: ["customerId", "metric"],
    where: { organizationId: org, customerId: { in: ids } },
  });
  const distinct = new Map<string, number>();
  for (const g of metricGroups)
    distinct.set(g.customerId, (distinct.get(g.customerId) ?? 0) + 1);

  const customers = await prisma.customer.findMany({
    where: { organizationId: org, id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  return groups
    .filter((g) => nameById.has(g.customerId)) // ignora pacientes excluídos
    .map((g) => ({
      id: g.customerId,
      name: nameById.get(g.customerId) as string,
      metrics: distinct.get(g.customerId) ?? 0,
      measurements: g._count._all,
      lastAt: g._max.measuredAt ? g._max.measuredAt.toISOString() : null,
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export type MeasurementResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface MeasurementInput {
  customerId: string;
  metric: string;
  label?: string;
  value: number;
  unit?: string;
  measuredAt: Date;
  notes?: string;
}

function validate(input: MeasurementInput): string | null {
  if (!input.customerId) return "Paciente é obrigatório.";
  if (!input.metric || !input.metric.trim()) return "Escolha um indicador.";
  if (!Number.isFinite(input.value)) return "Valor inválido.";
  if (input.value < -100000 || input.value > 1000000)
    return "Valor fora da faixa.";
  if (!(input.measuredAt instanceof Date) || isNaN(input.measuredAt.getTime()))
    return "Data inválida.";
  return null;
}

/** Normaliza a chave do indicador (livre) para um slug estável. */
export function normalizeMetric(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function addMeasurement(
  org: string,
  actor: { id: string; name: string },
  input: MeasurementInput,
): Promise<MeasurementResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  const metric = normalizeMetric(input.metric);
  if (!metric) return { ok: false, error: "Indicador inválido." };
  const preset = presetOf(metric);

  const created = await prisma.patientMetric.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      metric,
      label: (input.label ?? preset?.label ?? input.metric).trim(),
      value: input.value,
      unit: (input.unit ?? preset?.unit ?? "").trim(),
      measuredAt: input.measuredAt,
      notes: (input.notes ?? "").trim(),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function deleteMeasurement(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.patientMetric.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Medição não encontrada." };
  await prisma.patientMetric.delete({ where: { id } });
  return { ok: true };
}
