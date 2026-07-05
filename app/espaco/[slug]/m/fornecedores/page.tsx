import { Truck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { listSuppliers } from "@/lib/endurance/suppliers";
import { parsePage } from "@/lib/endurance/pagination";
import SuppliersClient from "../suppliers-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
} from "../module-kit";

// Cadastro completo de fornecedores: busca, filtros, paginação, export e
// histórico. Pedidos de compra migraram para o módulo "Pedidos de compra".
export default async function FornecedoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; status?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "fornecedores");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await listSuppliers(session.org, {
        q: sp.q,
        status: sp.status,
        page: parsePage(sp.pagina),
      })
    : null;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!data ? (
        <EmptyCard>Sessão expirada.</EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Truck}
              label="Fornecedores"
              value={String(data.kpis.total)}
              from="from-brand-500"
              to="to-brand-600"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Ativos"
              value={String(data.kpis.ativos)}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={XCircle}
              label="Inativos"
              value={String(data.kpis.inativos)}
              from="from-slate-500"
              to="to-slate-600"
            />
            <KpiCard
              icon={Clock}
              label="Entrega média"
              value={data.kpis.avgLeadTime ? `${data.kpis.avgLeadTime} dias` : "—"}
              from="from-cyan-500"
              to="to-cyan-600"
            />
          </div>

          <SuppliersClient
            slug={slug}
            rows={data.rows}
            meta={data.meta}
            q={sp.q ?? ""}
            status={sp.status ?? ""}
          />
        </>
      )}
    </div>
  );
}
