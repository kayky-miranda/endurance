import { CalendarCheck, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { getDayAgenda, listProfessionals } from "@/lib/endurance/agenda";
import { toDateInput } from "@/lib/endurance/scheduling";
import { loadModule, DeniedModule, ModuleHeader, KpiCard } from "../module-kit";
import AgendaClient from "./agenda-client";

/**
 * Agenda de atendimentos — consultas, sessões e serviços com hora marcada.
 * Módulo dos nichos de serviço (nutrição, psicologia, clínica, salão).
 */
export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dia?: string; prof?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "agenda_consultas");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const date = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : toDateInput(new Date());

  const [agenda, professionals] = session
    ? await Promise.all([
        getDayAgenda(session.org, date, { professionalId: sp.prof || undefined }),
        listProfessionals(session.org),
      ])
    : [null, []];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      {agenda && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CalendarClock}
              label="Atendimentos no dia"
              value={String(agenda.total)}
              sub={`${agenda.counts.agendado + agenda.counts.confirmado} em aberto`}
              from="from-cyan-500"
            />
            <KpiCard
              icon={CalendarCheck}
              label="Confirmados"
              value={String(agenda.counts.confirmado)}
              from="from-violet-500"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Atendidos"
              value={String(agenda.counts.atendido)}
              sub={agenda.revenue > 0 ? `R$ ${agenda.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined}
              from="from-emerald-500"
            />
            <KpiCard
              icon={XCircle}
              label="Faltas / cancelados"
              value={String(agenda.counts.faltou + agenda.counts.cancelado)}
              from="from-rose-500"
            />
          </div>

          <AgendaClient
            slug={slug}
            date={date}
            professionalId={sp.prof || ""}
            agenda={agenda}
            professionals={professionals}
          />
        </>
      )}
    </div>
  );
}
