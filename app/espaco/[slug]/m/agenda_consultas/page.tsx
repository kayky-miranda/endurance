import { CalendarCheck, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { getDayAgenda, getAgendaRange, listProfessionals } from "@/lib/endurance/agenda";
import {
  toDateInput,
  startOfWeek,
  startOfMonth,
  monthGridDays,
  addDays,
} from "@/lib/endurance/scheduling";
import { loadModule, DeniedModule, ModuleHeader, KpiCard } from "../module-kit";
import AgendaView, { type AgendaViewMode } from "./agenda-client";

/**
 * Agenda de atendimentos — visões dia / semana / mês (estilo calendário).
 * Módulo dos nichos de serviço (nutrição, psicologia, clínica, salão).
 */
export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; data?: string; dia?: string; prof?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "agenda_consultas");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const view: AgendaViewMode = (["dia", "semana", "mes"] as const).includes(
    sp.view as AgendaViewMode,
  )
    ? (sp.view as AgendaViewMode)
    : "dia";

  const rawDate = sp.data ?? sp.dia;
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toDateInput(new Date());
  const anchor = parseDate(date);
  const prof = sp.prof || undefined;

  // Intervalo carregado conforme a visão.
  const { from, to } = rangeFor(view, anchor);

  const [dayAgenda, rangeAppts, professionals] = session
    ? await Promise.all([
        getDayAgenda(session.org, date, { professionalId: prof }),
        getAgendaRange(session.org, from, to, { professionalId: prof }),
        listProfessionals(session.org),
      ])
    : [null, [], []];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      {dayAgenda && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CalendarClock}
              label="Atendimentos no dia"
              value={String(dayAgenda.total)}
              sub={`${dayAgenda.counts.agendado + dayAgenda.counts.confirmado} em aberto`}
              from="from-cyan-500"
            />
            <KpiCard icon={CalendarCheck} label="Confirmados" value={String(dayAgenda.counts.confirmado)} from="from-violet-500" />
            <KpiCard
              icon={CheckCircle2}
              label="Atendidos"
              value={String(dayAgenda.counts.atendido)}
              sub={dayAgenda.revenue > 0 ? `R$ ${dayAgenda.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined}
              from="from-emerald-500"
            />
            <KpiCard icon={XCircle} label="Faltas / cancelados" value={String(dayAgenda.counts.faltou + dayAgenda.counts.cancelado)} from="from-rose-500" />
          </div>

          <AgendaView
            slug={slug}
            view={view}
            date={date}
            professionalId={sp.prof || ""}
            appointments={view === "dia" ? dayAgenda.appointments : rangeAppts}
            professionals={professionals}
          />
        </>
      )}
    </div>
  );
}

function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)!;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Intervalo [from, to) que a visão precisa carregar. */
function rangeFor(view: AgendaViewMode, anchor: Date): { from: Date; to: Date } {
  if (view === "semana") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "mes") {
    // A grade do mês mostra 42 dias (inclui bordas de meses vizinhos).
    const grid = monthGridDays(startOfMonth(anchor));
    return { from: grid[0], to: addDays(grid[41], 1) };
  }
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  return { from, to: addDays(from, 1) };
}
