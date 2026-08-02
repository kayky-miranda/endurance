import {
  CalendarClock,
  CalendarCheck,
  UserRound,
  AlertTriangle,
  Clock,
  Stethoscope,
  Pill,
  Ruler,
  Paperclip,
  FileText,
  ClipboardList,
  XCircle,
  CalendarX,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  PatientBriefing,
  MetricTrend,
} from "@/lib/endurance/patient-briefing";
import { formatMetric, sparklinePoints } from "@/lib/endurance/metrics";
import type {
  EventKind,
  PendingLevel,
} from "@/lib/endurance/patient-briefing-rules";

/**
 * Briefing pré-consulta. Server Component: os dados são determinísticos e vêm
 * do banco, então já chegam prontos com a página — sem espera, sem IA e sem
 * risco de conteúdo inventado.
 */

const dt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const EVENT_META: Record<EventKind, { icon: LucideIcon; cls: string }> = {
  consulta: { icon: Stethoscope, cls: "bg-brand-500/10 text-brand-600 dark:text-brand-300" },
  falta: { icon: CalendarX, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  cancelamento: { icon: XCircle, cls: "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400" },
  anotacao: { icon: ClipboardList, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  prescricao: { icon: Pill, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  medicao: { icon: Ruler, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  anexo: { icon: Paperclip, cls: "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400" },
  atestado: { icon: FileText, cls: "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400" },
  anamnese: { icon: ClipboardList, cls: "bg-brand-500/10 text-brand-600 dark:text-brand-300" },
  exame: { icon: FlaskConical, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
};

const PENDING_STYLE: Record<PendingLevel, string> = {
  alta: "border-rose-300/70 bg-rose-500/5 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
  media: "border-amber-300/70 bg-amber-500/5 text-amber-700 dark:border-amber-500/30 dark:text-amber-300",
  baixa: "border-slate-200 bg-slate-50 text-slate-600 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-300",
};

const SPARK_W = 120;
const SPARK_H = 28;

/**
 * Comparação temporal dos indicadores, ao lado do prontuário — o profissional vê
 * a evolução sem trocar de módulo. Reaproveita `seriesStats`/`sparklinePoints`
 * do módulo de Evolução em vez de recalcular tendência aqui.
 */
function TrendStrip({ trends }: { trends: MetricTrend[] }) {
  if (trends.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {trends.slice(0, 6).map((t) => {
        const { stats } = t;
        // "Melhor" depende do indicador: perder peso melhora, ganhar força
        // também — quem sabe disso é o preset, já refletido em `improving`.
        const tone =
          stats.direction === "flat"
            ? "text-slate-400"
            : stats.improving
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400";
        const arrow = stats.direction === "up" ? "↑" : stats.direction === "down" ? "↓" : "→";
        return (
          <div
            key={t.metric}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {t.label}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-none text-slate-800 dark:text-slate-100">
                  {formatMetric(stats.last, t.decimals)}
                  <span className="ml-1 text-xs font-normal text-slate-400">{t.unit}</span>
                </p>
                <p className={`mt-1 text-[11px] font-medium ${tone}`}>
                  {arrow} {stats.delta > 0 ? "+" : ""}
                  {formatMetric(stats.delta, t.decimals)} {t.unit}
                  <span className="font-normal text-slate-400">
                    {" "}· desde {dt(t.lastAt)}
                  </span>
                </p>
              </div>
              {t.values.length > 1 && (
                <svg
                  width={SPARK_W}
                  height={SPARK_H}
                  viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                  className="shrink-0"
                  role="img"
                  aria-label={`Evolução de ${t.label}: ${t.values.map((v) => formatMetric(v, t.decimals)).join(", ")} ${t.unit}`}
                >
                  <polyline
                    points={sparklinePoints(t.values, SPARK_W, SPARK_H)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-brand-500"
                  />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BriefingPanel({ briefing }: { briefing: PatientBriefing }) {
  const { summary, timeline, pendencies, trends } = briefing;

  return (
    <section className="space-y-3">
      {/* Resumo executivo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={UserRound}
          label="Paciente"
          value={
            [
              summary.age !== null ? `${summary.age} anos` : null,
              summary.sex || null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"
          }
          sub={summary.insuranceName || undefined}
        />
        <Stat
          icon={Clock}
          label="Acompanhado há"
          value={summary.tenure ?? "—"}
          sub={`${summary.totalVisits} atendimento(s)`}
        />
        <Stat
          icon={CalendarCheck}
          label="Última consulta"
          value={summary.lastVisitAt ? dt(summary.lastVisitAt) : "—"}
          sub={summary.missedVisits > 0 ? `${summary.missedVisits} falta(s)` : undefined}
        />
        <Stat
          icon={CalendarClock}
          label="Próxima consulta"
          value={summary.nextVisitAt ? dt(summary.nextVisitAt) : "não agendada"}
        />
      </div>

      {/* Comparação temporal dos indicadores acompanhados. */}
      <TrendStrip trends={trends} />

      {/* Pendências: o que exige ação, antes de qualquer outra coisa. */}
      {pendencies.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {pendencies.map((p, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 ${PENDING_STYLE[p.level]}`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{p.title}</p>
                <p className="mt-0.5 text-[11px] opacity-90">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Linha do tempo */}
      {timeline.length > 0 && (
        <details className="group rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-500" /> Linha do tempo
              <span className="text-xs font-normal text-slate-400">
                · {timeline.length} registro(s)
              </span>
            </span>
            <span className="text-xs font-normal text-slate-400 group-open:hidden">
              ver
            </span>
          </summary>
          <ol className="border-t border-slate-100 px-5 py-3 dark:border-ink-800">
            {timeline.map((e, i) => {
              const meta = EVENT_META[e.kind];
              const Icon = meta.icon;
              return (
                <li key={i} className="flex gap-3 py-1.5">
                  <span className="w-20 shrink-0 pt-0.5 text-[11px] text-slate-400">
                    {dt(e.at)}
                  </span>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${meta.cls}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                      {e.title}
                      {e.cid && (
                        <span className="ml-1.5 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                          CID {e.cid}
                        </span>
                      )}
                    </span>
                    {e.detail && (
                      <span className="block truncate text-[11px] text-slate-400">
                        {e.detail}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
