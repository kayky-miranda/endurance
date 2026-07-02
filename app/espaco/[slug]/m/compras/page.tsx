import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Truck,
  PiggyBank,
  Clock,
} from "lucide-react";
import { getPurchasingAnalytics } from "@/lib/endurance/purchasing-analytics";
import {
  PurchasesByMonthChart,
  CategoryChart,
} from "../charts-lazy";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  RankList,
  brl,
} from "../module-kit";

// Painel executivo de Compras (KPIs + gráficos + rankings).
export default async function ComprasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "compras");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) {
    return (
      <div className="space-y-6">
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
        <EmptyCard>Sessão expirada.</EmptyCard>
      </div>
    );
  }

  const a = await getPurchasingAnalytics(session.org, 6);

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={DollarSign}
          label="Compras no mês"
          value={brl(a.kpis.comprasMes)}
          sub={`${a.kpis.pedidosMes} pedido(s) no mês`}
          from="from-brand-500"
          to="to-brand-600"
        />
        <KpiCard
          icon={PiggyBank}
          label="Economia em negociação"
          value={brl(a.kpis.economia)}
          sub="diferença entre a maior proposta e a vencedora"
          from="from-emerald-500"
          to="to-emerald-600"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Pedidos em atraso"
          value={String(a.kpis.pedidosAtraso)}
          from="from-rose-500"
          to="to-rose-600"
        />
        <KpiCard
          icon={Truck}
          label="Fornecedores ativos"
          value={String(a.kpis.fornecedoresAtivos)}
          from="from-cyan-500"
          to="to-cyan-600"
        />
        <KpiCard
          icon={Clock}
          label="Lead time médio"
          value={a.kpis.leadTimeMedio ? `${a.kpis.leadTimeMedio} dias` : "—"}
          sub="da emissão ao recebimento"
          from="from-violet-500"
          to="to-violet-600"
        />
        <KpiCard
          icon={ShoppingCart}
          label="Pedidos no mês"
          value={String(a.kpis.pedidosMes)}
          from="from-slate-500"
          to="to-slate-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Compras por mês
          </h2>
          <PurchasesByMonthChart data={a.byMonth} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Compras por categoria
          </h2>
          <CategoryChart data={a.byCategory} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankList
          title="Top fornecedores (por valor)"
          rows={a.topSuppliers.map((s) => ({
            label: s.name,
            meta: `${s.orders} pedido(s)`,
            value: brl(s.value),
          }))}
        />
        <RankList
          title="Lead time por fornecedor"
          rows={a.leadBySupplier.map((s) => ({
            label: s.name,
            meta: "média",
            value: `${s.days} dias`,
          }))}
        />
      </div>

      {a.overdue.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-500/5 p-5 dark:border-rose-500/30">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            Pedidos em atraso
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-1.5 pr-4 font-medium">Pedido</th>
                  <th className="py-1.5 pr-4 font-medium">Fornecedor</th>
                  <th className="py-1.5 pr-4 font-medium">Previsto</th>
                  <th className="py-1.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {a.overdue.map((o) => (
                  <tr key={o.code} className="border-t border-rose-200/50 dark:border-rose-500/20">
                    <td className="py-1.5 pr-4 font-mono text-slate-700 dark:text-slate-200">
                      {o.code}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">
                      {o.supplier}
                    </td>
                    <td className="py-1.5 pr-4 text-rose-600 dark:text-rose-400">
                      {o.expected}
                    </td>
                    <td className="py-1.5 text-right font-medium text-slate-700 dark:text-slate-200">
                      {brl(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
