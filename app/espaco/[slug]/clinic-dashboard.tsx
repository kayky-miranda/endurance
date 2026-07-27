import Link from "next/link";
import {
  CalendarClock,
  DollarSign,
  UserPlus,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  TrendingUp,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getClinicDashboard } from "@/lib/endurance/clinic-dashboard";
import { getNoShowRisk } from "@/lib/endurance/no-show";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/endurance/scheduling";
import { KpiCard } from "./m/module-kit";
import { AppointmentsByDayChart, StatusMixChart } from "./m/charts-lazy";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  agendado: "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300",
  confirmado: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  atendido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  faltou: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  cancelado: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};

const ALERT_STYLE = {
  info: { cls: "border-brand-200 bg-brand-500/5 text-slate-600 dark:border-brand-500/20 dark:text-slate-300", icon: Info },
  warning: { cls: "border-amber-200 bg-amber-500/5 text-amber-700 dark:border-amber-500/20 dark:text-amber-300", icon: AlertTriangle },
  danger: { cls: "border-rose-200 bg-rose-500/5 text-rose-700 dark:border-rose-500/20 dark:text-rose-300", icon: AlertTriangle },
} as const;

/**
 * Painel da clínica — retrato operacional do dia + indicadores do período,
 * alimentado pela Agenda e pelo financeiro das consultas. Server Component:
 * busca e agrega no servidor, entrega a UI pronta.
 */
export default async function ClinicDashboard({
  orgId,
  slug,
}: {
  orgId: string;
  slug: string;
}) {
  const [d, noShowRisk] = await Promise.all([
    getClinicDashboard(orgId, { periodDays: 30 }),
    getNoShowRisk(orgId),
  ]);

  return (
    <div className="space-y-6">
      {/* Alertas importantes */}
      {d.alertas.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {d.alertas.map((a, i) => {
            const st = ALERT_STYLE[a.level];
            const Icon = st.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${st.cls}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{a.message}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CalendarClock}
          label="Consultas hoje"
          value={String(d.today.total)}
          sub={`${d.today.agendados + d.today.confirmados} em aberto · ${d.today.atendidos} concluídas`}
          from="from-cyan-500"
        />
        <KpiCard
          icon={DollarSign}
          label="Faturamento do dia"
          value={brl(d.faturamentoDia)}
          sub={`Mês: ${brl(d.faturamentoMes)}`}
          from="from-emerald-500"
        />
        <KpiCard
          icon={Activity}
          label="Ocupação da agenda"
          value={`${d.taxaOcupacao}%`}
          sub="hoje, base 8h/profissional"
          from="from-violet-500"
        />
        <KpiCard
          icon={UserPlus}
          label="Novos pacientes"
          value={String(d.novosPacientesMes)}
          sub={`${d.novosPacientesHoje} hoje`}
          from="from-amber-500"
        />
      </div>

      {/* Faixa operacional do dia */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Clock} label="Aguardando" value={d.today.aguardando} tone="amber" />
        <MiniStat icon={Stethoscope} label="Em andamento" value={d.today.emAndamento} tone="cyan" />
        <MiniStat icon={CheckCircle2} label="Concluídas" value={d.today.atendidos} tone="emerald" />
        <MiniStat
          icon={XCircle}
          label="Faltas / cancel."
          value={d.today.faltas + d.today.cancelados}
          tone="rose"
        />
      </div>

      {/* Risco de falta — pacientes de hoje com histórico alto de faltas */}
      {noShowRisk.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-500/5 p-4 dark:border-amber-500/20">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Risco de falta hoje
            <span className="text-xs font-normal text-amber-600/80">
              · confirme estes pacientes
            </span>
          </h2>
          <ul className="divide-y divide-amber-200/50 dark:divide-amber-500/10">
            {noShowRisk.slice(0, 6).map((r) => (
              <li key={r.appointmentId} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-12 shrink-0 font-semibold text-slate-700 dark:text-slate-200">{r.time}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{r.patient}</span>
                {r.professional && (
                  <span className="hidden text-xs text-slate-400 sm:inline">{r.professional}</span>
                )}
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {Math.round(r.rate * 100)}% faltas ({r.pastFaltas}/{r.pastFinalized})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximas consultas */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Próximas consultas de hoje
            </h2>
            <Link
              href={`/espaco/${slug}/m/agenda_consultas`}
              className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
            >
              ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {d.upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma consulta pendente para o resto do dia.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-ink-800">
              {d.upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-12 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {a.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {a.patient}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {[a.service, a.professional].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Indicadores do período */}
        <section className="space-y-3">
          <RateCard label="Taxa de faltas (30d)" value={`${d.taxaFaltas}%`} danger={d.taxaFaltas >= 20} />
          <RateCard label="Cancelamentos (30d)" value={String(d.cancelamentosPeriodo)} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5" /> Ranking de profissionais
            </h3>
            {d.ranking.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">Sem atendimentos no período.</p>
            ) : (
              <ol className="space-y-1.5">
                {d.ranking.map((r, i) => (
                  <li key={r.professional} className="flex items-center gap-2 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                      {r.professional}
                    </span>
                    <span className="text-xs text-slate-400">{r.atendidos} atend.</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {brl(r.faturamento)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Consultas por dia (14 dias)
          </h2>
          <AppointmentsByDayChart data={d.porDia} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Consultas por status (30d)
          </h2>
          <StatusMixChart data={d.statusMix} />
        </div>
      </div>

      {/* Análises completas (produtividade, comissões) vivem em página própria
          para manter o home leve e rápido. */}
      <Link
        href={`/espaco/${slug}/m/relatorios_clinica`}
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm transition hover:border-brand-500/40 hover:shadow-md dark:border-ink-700 dark:bg-ink-900"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <TrendingUp className="h-4 w-4 text-brand-500" /> Relatórios da clínica
          <span className="hidden text-xs font-normal text-slate-400 sm:inline">
            · produtividade, comissões e indicadores por período
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-brand-500">
          abrir <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}

const TONE: Record<string, string> = {
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  cyan: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof TONE | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONE[tone] ?? TONE.cyan}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-slate-800 dark:text-slate-100">{value}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function RateCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger ? "text-rose-500" : "text-slate-800 dark:text-slate-100"}`}>
        {value}
      </p>
    </div>
  );
}
