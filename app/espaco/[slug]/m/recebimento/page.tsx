import { Truck, Layers, PackageCheck } from "lucide-react";
import { listReceivableOrders } from "@/lib/endurance/receiving";
import { parsePage } from "@/lib/endurance/pagination";
import ReceivingClient from "../receiving-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
} from "../module-kit";

// Recebimento de materiais: conferência → estoque (ledger) + conta a pagar.
export default async function RecebimentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "recebimento");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const data = await listReceivableOrders(session.org, {
    page: parsePage(sp.pagina),
  });

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Truck}
          label="A receber"
          value={String(data.kpis.aReceber)}
          from="from-brand-500"
          to="to-brand-600"
        />
        <KpiCard
          icon={Layers}
          label="Recebimentos parciais"
          value={String(data.kpis.parciais)}
          from="from-amber-500"
          to="to-amber-600"
        />
        <KpiCard
          icon={PackageCheck}
          label="Recebidos no mês"
          value={String(data.kpis.recebidosMes)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
      </div>

      <ReceivingClient slug={slug} rows={data.rows} meta={data.meta} />
    </div>
  );
}
