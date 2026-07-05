import { ClipboardList, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  listRequisitions,
  listCostCenters,
} from "@/lib/endurance/requisitions";
import { parsePage } from "@/lib/endurance/pagination";
import { canAccessModule } from "@/lib/endurance/permissions";
import { money } from "@/lib/endurance/money";
import RequisitionsClient from "../requisitions-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Solicitações de compra: requisição de materiais → aprovação.
export default async function SolicitacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "solicitacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const [data, costCenters, productList] = await Promise.all([
    listRequisitions(session.org, { status: sp.status, page: parsePage(sp.pagina) }),
    listCostCenters(session.org),
    prisma.product.findMany({
      where: { organizationId: session.org },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true },
    }),
  ]);

  const canManage = canAccessModule(
    session.role,
    session.permissions,
    "compras",
  );

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          label="Abertas"
          value={String(data.kpis.abertas)}
          from="from-slate-500"
          to="to-slate-600"
        />
        <KpiCard
          icon={Clock}
          label="Em aprovação"
          value={String(data.kpis.emAprovacao)}
          from="from-amber-500"
          to="to-amber-600"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Aprovadas"
          value={String(data.kpis.aprovadas)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={DollarSign}
          label="Valor pendente"
          value={brl(data.kpis.valorAberto)}
          from="from-brand-500"
          to="to-brand-600"
        />
      </div>

      <RequisitionsClient
        slug={slug}
        rows={data.rows}
        meta={data.meta}
        status={sp.status ?? ""}
        products={productList.map((p) => ({
          id: p.id,
          name: p.name,
          cost: money(p.cost),
        }))}
        costCenters={costCenters}
        canManage={canManage}
      />
    </div>
  );
}
