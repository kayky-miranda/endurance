import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { ageFromBirth } from "./patient";
import { presetOf, seriesStats, type SeriesStats } from "./metrics";
import { getPatientExams } from "./lab-exams";
import {
  computePendencies,
  sortTimeline,
  tenureLabel,
  type Pendency,
  type TimelineEvent,
} from "./patient-briefing-rules";

/**
 * Briefing pré-consulta: o retrato do paciente que aparece assim que a ficha
 * abre. É DETERMINÍSTICO — sai direto do banco, sem IA — então custa alguns
 * milissegundos e nunca inventa nada. A análise assistida por IA é a camada
 * seguinte, sob demanda, para o que exige interpretação.
 *
 * Todas as leituras saem numa única leva paralela, com `select` enxuto e
 * limites de linha.
 */

export interface BriefingSummary {
  name: string;
  age: number | null;
  sex: string;
  insuranceName: string;
  /** Há quanto tempo é paciente da casa. */
  tenure: string | null;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  totalVisits: number;
  missedVisits: number;
}

/**
 * Série de um indicador acompanhado (peso, PA, escalas…) já com a tendência
 * calculada. Fica no briefing para o profissional ver a evolução SEM sair do
 * prontuário — reaproveita os mesmos helpers do módulo de Evolução.
 */
export interface MetricTrend {
  metric: string;
  label: string;
  unit: string;
  decimals: number;
  /** Cronológico (antigo → recente). */
  values: number[];
  lastAt: string;
  stats: SeriesStats;
}

export interface PatientBriefing {
  summary: BriefingSummary;
  timeline: TimelineEvent[];
  pendencies: Pendency[];
  trends: MetricTrend[];
  /** Quantidade de blocos de informação — base do "dados insuficientes". */
  signals: number;
}

/** Pontos por indicador: o bastante para ver a tendência, sem inflar a página. */
const MAX_TREND_POINTS = 8;

const MAX_TIMELINE = 40;
const iso = (d: Date) => d.toISOString();

export async function getPatientBriefing(
  org: string,
  customerId: string,
  now = new Date(),
): Promise<PatientBriefing | null> {
  const [customer, profile, anamnese, notes, metrics, appointments, prescriptions, attachments, exams, certificates] =
    await Promise.all([
      prisma.customer.findFirst({
        where: { id: customerId, organizationId: org },
        select: { name: true, createdAt: true },
      }),
      prisma.patientProfile.findFirst({
        where: { organizationId: org, customerId },
        select: { birthDate: true, sex: true, insuranceName: true },
      }),
      prisma.anamnese.findFirst({
        where: { organizationId: org, customerId },
        select: { status: true, updatedAt: true },
      }),
      prisma.clinicalNote.findMany({
        where: { organizationId: org, customerId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { createdAt: true, title: true, cid: true, cidDescription: true },
      }),
      prisma.patientMetric.findMany({
        where: { organizationId: org, customerId },
        orderBy: { measuredAt: "desc" },
        // Mais linhas do que a timeline usa: são várias séries (peso, PA…) e
        // cada uma precisa de pontos suficientes para a tendência.
        take: 60,
        select: { label: true, metric: true, value: true, unit: true, measuredAt: true },
      }),
      prisma.appointment.findMany({
        where: { organizationId: org, customerId },
        orderBy: { startsAt: "desc" },
        take: 30,
        select: { startsAt: true, status: true, service: true, professional: true },
      }),
      prisma.prescription.findMany({
        where: { organizationId: org, customerId },
        orderBy: { issuedAt: "desc" },
        take: 10,
        select: {
          issuedAt: true,
          cid: true,
          items: { select: { medication: true }, orderBy: { position: "asc" } },
        },
      }),
      prisma.patientAttachment.findMany({
        where: { organizationId: org, customerId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { createdAt: true, name: true, category: true },
      }),
      getPatientExams(org, customerId, 40),
      prisma.certificate.findMany({
        where: { organizationId: org, customerId },
        orderBy: { issuedAt: "desc" },
        take: 5,
        select: { issuedAt: true, kind: true },
      }),
    ]);

  if (!customer) return null;

  const events: TimelineEvent[] = [];
  for (const a of appointments) {
    const kind =
      a.status === "faltou" ? "falta" : a.status === "cancelado" ? "cancelamento" : "consulta";
    events.push({
      kind,
      at: iso(a.startsAt),
      title: a.service || "Atendimento",
      detail: [a.professional, a.status].filter(Boolean).join(" · "),
    });
  }
  for (const n of notes)
    events.push({
      kind: "anotacao",
      at: iso(n.createdAt),
      title: n.title || "Anotação clínica",
      detail: n.cidDescription || undefined,
      cid: n.cid || undefined,
    });
  for (const p of prescriptions)
    events.push({
      kind: "prescricao",
      at: iso(p.issuedAt),
      title: "Prescrição",
      detail: p.items.map((i) => i.medication).filter(Boolean).join(", ") || undefined,
      cid: p.cid || undefined,
    });
  // A timeline mostra só as medições recentes; a tendência usa a série inteira.
  for (const m of metrics.slice(0, 15))
    events.push({
      kind: "medicao",
      at: iso(m.measuredAt),
      title: m.label || m.metric,
      detail: `${money(m.value)}${m.unit}`,
    });

  // Agrupa por indicador (vêm em ordem decrescente) e inverte para cronológico.
  const byMetric = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const list = byMetric.get(m.metric) ?? [];
    if (list.length < MAX_TREND_POINTS) list.push(m);
    byMetric.set(m.metric, list);
  }
  const trends: MetricTrend[] = [];
  for (const [metric, list] of byMetric) {
    const chrono = [...list].reverse();
    const values = chrono.map((x) => money(x.value));
    const preset = presetOf(metric);
    const higherIsBetter = preset?.higherIsBetter ?? false;
    const stats = seriesStats(values, higherIsBetter);
    if (!stats) continue;
    trends.push({
      metric,
      label: preset?.label || chrono[chrono.length - 1].label || metric,
      unit: chrono[chrono.length - 1].unit || preset?.unit || "",
      decimals: preset?.decimals ?? 1,
      values,
      lastAt: iso(chrono[chrono.length - 1].measuredAt),
      stats,
    });
  }
  // Indicador com medição mais recente primeiro.
  trends.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  for (const at of attachments)
    events.push({
      kind: "anexo",
      at: iso(at.createdAt),
      title: at.name,
      detail: at.category || undefined,
    });
  for (const e of exams.exams.slice(0, 12))
    events.push({
      kind: "exame",
      at: e.collectedAt,
      title: e.name,
      detail: `${e.value}${e.unit} · ${e.rangeLabel}`,
    });
  for (const c of certificates)
    events.push({ kind: "atestado", at: iso(c.issuedAt), title: "Atestado", detail: c.kind });
  if (anamnese)
    events.push({
      kind: "anamnese",
      at: iso(anamnese.updatedAt),
      title: "Anamnese",
      detail: anamnese.status === "concluida" ? "concluída" : "rascunho",
    });

  const attended = appointments.filter((a) => a.status === "atendido");
  const missed = appointments.filter((a) => a.status === "faltou");
  const lastVisit = attended[0]?.startsAt ?? null;
  const next = [...appointments]
    .filter((a) => a.startsAt > now && a.status !== "cancelado")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  // "Paciente desde": o marco mais antigo que temos — a primeira consulta, ou o
  // cadastro quando ainda não houve atendimento.
  const firstAppointment = appointments[appointments.length - 1]?.startsAt ?? null;
  const since =
    firstAppointment && firstAppointment < customer.createdAt
      ? firstAppointment
      : customer.createdAt;

  const pendencies = computePendencies({
    now,
    appointments: appointments.map((a) => ({
      startsAt: a.startsAt,
      status: a.status,
      service: a.service,
    })),
    hasAnamnese: Boolean(anamnese),
    anamneseComplete: anamnese?.status === "concluida",
    lastMetricAt: metrics[0]?.measuredAt ?? null,
    lastPrescriptionAt: prescriptions[0]?.issuedAt ?? null,
    alteredExams: exams.alteredCount,
    severeExams: exams.severeCount,
  });

  const signals = [
    Boolean(anamnese),
    notes.length > 0,
    metrics.length > 0,
    appointments.length > 0,
    prescriptions.length > 0,
    exams.exams.length > 0,
  ].filter(Boolean).length;

  return {
    summary: {
      name: customer.name,
      age: ageFromBirth(profile?.birthDate ?? null),
      sex: profile?.sex ?? "",
      insuranceName: profile?.insuranceName ?? "",
      tenure: tenureLabel(since, now),
      lastVisitAt: lastVisit ? iso(lastVisit) : null,
      nextVisitAt: next ? iso(next.startsAt) : null,
      totalVisits: attended.length,
      missedVisits: missed.length,
    },
    timeline: sortTimeline(events).slice(0, MAX_TIMELINE),
    trends,
    pendencies,
    signals,
  };
}
