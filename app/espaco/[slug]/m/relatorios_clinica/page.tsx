import { CalendarCheck2, DollarSign, Percent, TrendingUp } from "lucide-react";
import { getProductivityReport } from "@/lib/endurance/productivity";
import { getCommissionReport } from "@/lib/endurance/commissions";
import { sessionHasPermission } from "@/lib/auth";
import { parsePeriod, periodLabel } from "@/lib/endurance/period";
import { loadModule, DeniedModule, ModuleHeader, KpiCard, EmptyCard } from "../module-kit";
import { PeriodFilter } from "../period-filter";
import ProductivityPanel from "../../productivity-panel";
import CommissionsPanel from "../../commissions-panel";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Relatórios da clínica — página dedicada de análise por período (produtividade
 * e comissões dos profissionais), aliviando o dashboard do home. Server
 * Component: agrega no banco conforme o período da URL (?dias=) e entrega a UI.
 */
export default async function RelatoriosClinicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "relatorios_clinica");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada. Entre novamente para ver os relatórios.</EmptyCard>
      </div>
    );
  }

  const days = parsePeriod(sp, 30);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const label = periodLabel(days);

  const [productivity, commissions] = await Promise.all([
    getProductivityReport(session.org, from, to),
    getCommissionReport(session.org, from, to),
  ]);
  const canConfigCommission = sessionHasPermission(session, "settings.general");

  const totalFinalized = productivity.rows.reduce((s, r) => s + r.atendidos + r.faltas, 0);
  const totalAtendidos = productivity.totalAtendidos;
  const attendanceRate =
    totalFinalized > 0 ? Math.round((totalAtendidos / totalFinalized) * 100) : 0;
  const avgTicket = totalAtendidos > 0 ? productivity.totalRevenue / totalAtendidos : 0;

  const hasData = productivity.rows.length > 0;

  return (
    <div className="space-y-6">
      <ModuleHeader
        slug={slug}
        label={mod.label}
        description={mod.description}
        action={<PeriodFilter days={days} />}
      />

      {!hasData ? (
        <EmptyCard>
          Nenhuma consulta atendida em {label.toLowerCase()}. Assim que houver
          atendimentos no período, os indicadores aparecem aqui.
        </EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CalendarCheck2}
              label="Atendimentos"
              value={String(totalAtendidos)}
              sub={label}
              from="from-cyan-500"
            />
            <KpiCard
              icon={TrendingUp}
              label="Comparecimento"
              value={`${attendanceRate}%`}
              sub="atendidos / (atendidos + faltas)"
              from="from-emerald-500"
            />
            <KpiCard
              icon={DollarSign}
              label="Faturamento"
              value={brl(productivity.totalRevenue)}
              sub={`Ticket médio ${brl(avgTicket)}`}
              from="from-violet-500"
            />
            <KpiCard
              icon={Percent}
              label="Comissões"
              value={brl(commissions.totalCommission)}
              sub={`${commissions.rows.length} profissional(is)`}
              from="from-amber-500"
            />
          </div>

          <ProductivityPanel report={productivity} periodLabel={label} defaultOpen />
          <CommissionsPanel
            report={commissions}
            canConfig={canConfigCommission}
            periodLabel={label}
            defaultOpen
          />
        </>
      )}
    </div>
  );
}
