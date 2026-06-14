import { DollarSign, FileText, PackageCheck, Truck } from "lucide-react";
import { getPurchasingOverview } from "@/lib/endurance/purchasing";
import PurchasingClient from "../purchasing-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Fornecedores + pedidos de compra (reposição → compra → estoque → financeiro).
export default async function FornecedoresPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "fornecedores");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session ? await getPurchasingOverview(session.org) : null;

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
              value={String(data.kpis.fornecedores)}
              from="from-brand-500"
              to="to-brand-600"
            />
            <KpiCard
              icon={FileText}
              label="Pedidos em aberto"
              value={String(data.kpis.pedidosAbertos)}
              from="from-amber-500"
              to="to-amber-600"
            />
            <KpiCard
              icon={DollarSign}
              label="Valor em aberto"
              value={brl(data.kpis.valorAberto)}
              from="from-cyan-500"
              to="to-cyan-600"
            />
            <KpiCard
              icon={PackageCheck}
              label="Recebido no mês"
              value={brl(data.kpis.recebidoMes)}
              from="from-emerald-500"
              to="to-emerald-600"
            />
          </div>

          <PurchasingClient
            slug={slug}
            suppliers={data.suppliers}
            orders={data.orders}
            products={data.products}
            suggestion={data.suggestion}
          />
        </>
      )}
    </div>
  );
}
