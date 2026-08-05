import { GitCompare, FileCheck2, Layers } from "lucide-react";
import {
  listQuotations,
  listApprovedRequisitions,
  listActiveSuppliers,
} from "@/lib/endurance/quotations";
import { parsePage } from "@/lib/endurance/pagination";
import QuotationsClient from "../quotations-client";
import {
  loadModule,
  DeniedModule,
  PlanLocked,
  ModuleHeader,
  EmptyCard,
  KpiCard,
} from "../module-kit";

// Cotações: comparativo de propostas de fornecedores.
export default async function CotacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied, planLocked, planFeature, requiredPlan } = await loadModule(slug, "cotacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (planLocked && planFeature)
    return (
      <PlanLocked
        slug={slug}
        mod={mod}
        feature={planFeature}
        requiredPlan={requiredPlan}
      />
    );
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const [data, requisitions, suppliers] = await Promise.all([
    listQuotations(session.org, { page: parsePage(sp.pagina) }),
    listApprovedRequisitions(session.org),
    listActiveSuppliers(session.org),
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={GitCompare}
          label="Em aberto"
          value={String(data.kpis.abertas)}
          from="from-amber-500"
          to="to-amber-600"
        />
        <KpiCard
          icon={FileCheck2}
          label="Fechadas"
          value={String(data.kpis.fechadas)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={Layers}
          label="Total"
          value={String(data.kpis.total)}
          from="from-brand-500"
          to="to-brand-600"
        />
      </div>

      <QuotationsClient
        slug={slug}
        rows={data.rows}
        meta={data.meta}
        requisitions={requisitions}
        suppliers={suppliers}
      />
    </div>
  );
}
