import { History, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  listStockMovements,
  productsForPicker,
  manualReasons,
} from "@/lib/endurance/stock-ledger";
import { parsePage } from "@/lib/endurance/pagination";
import StockLedgerClient from "../stock-ledger-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
} from "../module-kit";

// Razão de estoque: histórico auditável de toda entrada e saída.
export default async function MovimentacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ produto?: string; tipo?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "movimentacoes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const [data, products] = await Promise.all([
    listStockMovements(session.org, {
      productId: sp.produto,
      type: sp.tipo,
      page: parsePage(sp.pagina),
    }),
    productsForPicker(session.org),
  ]);
  const reasons = manualReasons().map((r) => ({
    id: r.id,
    label: r.label,
    dir: r.dir,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={ArrowDownLeft}
          label="Entradas"
          value={String(data.kpis.entradas)}
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={ArrowUpRight}
          label="Saídas"
          value={String(data.kpis.saidas)}
          from="from-rose-500"
          to="to-rose-600"
        />
        <KpiCard
          icon={History}
          label="Total de movimentos"
          value={String(data.kpis.total)}
          from="from-brand-500"
          to="to-brand-600"
        />
      </div>

      <StockLedgerClient
        slug={slug}
        rows={data.rows}
        meta={data.meta}
        products={products}
        reasons={reasons}
        filterType={sp.tipo ?? ""}
        filterProduct={sp.produto ?? ""}
      />
    </div>
  );
}
