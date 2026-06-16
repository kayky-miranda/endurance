import { ShoppingCart, Truck, PackageCheck, DollarSign } from "lucide-react";
import {
  listPurchaseOrders,
  listOrderableQuotations,
} from "@/lib/endurance/purchase-orders";
import { parsePage } from "@/lib/endurance/pagination";
import PurchaseOrdersClient from "../purchase-orders-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Pedidos de compra: gerados da cotação vencedora; ciclo aberto→…→recebido.
export default async function PedidosCompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "pedidos_compra");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const [data, orderable] = await Promise.all([
    listPurchaseOrders(session.org, { status: sp.status, page: parsePage(sp.pagina) }),
    listOrderableQuotations(session.org),
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          label="Abertos"
          value={String(data.kpis.abertos)}
          from="from-slate-500"
          to="to-slate-600"
        />
        <KpiCard
          icon={Truck}
          label="Em andamento"
          value={String(data.kpis.emAndamento)}
          from="from-sky-500"
          to="to-sky-600"
        />
        <KpiCard
          icon={PackageCheck}
          label="Recebidos"
          value={String(data.kpis.recebidos)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={DollarSign}
          label="Valor em aberto"
          value={brl(data.kpis.valorAberto)}
          from="from-brand-500"
          to="to-brand-600"
        />
      </div>

      <PurchaseOrdersClient
        slug={slug}
        rows={data.rows}
        meta={data.meta}
        status={sp.status ?? ""}
        orderable={orderable}
      />
    </div>
  );
}
