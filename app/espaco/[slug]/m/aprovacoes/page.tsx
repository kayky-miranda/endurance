import { Clock, DollarSign, CheckCircle2, XCircle } from "lucide-react";
import { listPendingApprovals } from "@/lib/endurance/approvals";
import { parsePage } from "@/lib/endurance/pagination";
import ApprovalsClient from "../approvals-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Caixa de aprovações de compra (workflow multinível).
export default async function AprovacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "aprovacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const data = await listPendingApprovals(session.org, {
    page: parsePage(sp.pagina),
  });

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          label="Pendentes"
          value={String(data.kpis.pendentes)}
          from="from-amber-500"
          to="to-amber-600"
        />
        <KpiCard
          icon={DollarSign}
          label="Valor pendente"
          value={brl(data.kpis.valorPendente)}
          from="from-brand-500"
          to="to-brand-600"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Aprovadas no mês"
          value={String(data.kpis.aprovadasMes)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={XCircle}
          label="Rejeitadas no mês"
          value={String(data.kpis.rejeitadasMes)}
          from="from-rose-500"
          to="to-rose-600"
        />
      </div>

      <ApprovalsClient rows={data.rows} meta={data.meta} />
    </div>
  );
}
