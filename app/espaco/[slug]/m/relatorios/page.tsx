import Link from "next/link";
import { ArrowLeft, FileText, ShoppingCart, TrendingUp, Trophy, Wallet } from "lucide-react";
import { getSalesSummary } from "@/lib/endurance/sales-analytics";
import { getCashflow, type DRE } from "@/lib/endurance/cashflow";
import InsightsPanel from "../insights-panel";
import { SalesByDayChart, PaymentMixChart, CashflowChart } from "../reports-charts";
import { loadModule, DeniedModule, KpiCard, RankList, brl } from "../module-kit";

// Painel executivo de vendas (alimentado pelas vendas reais do PDV).
export default async function RelatoriosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "relatorios");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const summary = session ? await getSalesSummary(session.org, 30) : null;
  const cashflow = session ? await getCashflow(session.org, 30) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/espaco/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Visão geral
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Painel executivo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vendas dos últimos {summary?.days ?? 30} dias — em tempo real, com
            insights gerados por IA.
          </p>
        </div>
        <Link
          href={`/espaco/${slug}/relatorio`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Link>
      </div>

      {!summary || summary.vendas === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ainda não há vendas registradas. Faça vendas no{" "}
            <Link
              href={`/espaco/${slug}/m/pdv`}
              className="font-medium text-brand-500 hover:underline"
            >
              PDV
            </Link>{" "}
            para alimentar o painel.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Wallet}
              label="Faturamento (30d)"
              value={brl(summary.faturamento)}
              sub={`Hoje: ${brl(summary.hojeFaturamento)}`}
              from="from-cyan-500"
              to="to-cyan-600"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Vendas"
              value={String(summary.vendas)}
              sub={`Hoje: ${summary.hojeVendas}`}
              from="from-violet-500"
              to="to-violet-600"
            />
            <KpiCard
              icon={TrendingUp}
              label="Ticket médio"
              value={brl(summary.ticketMedio)}
              sub={`${summary.itens} itens vendidos`}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={Trophy}
              label="Top produto"
              value={summary.topProdutos[0]?.name ?? "—"}
              sub={
                summary.topProdutos[0]
                  ? `${summary.topProdutos[0].qty} un. vendidas`
                  : ""
              }
              from="from-amber-500"
              to="to-amber-600"
            />
          </div>

          <InsightsPanel />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Vendas por dia
              </h2>
              <SalesByDayChart data={summary.porDia} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
              <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Formas de pagamento
              </h2>
              <PaymentMixChart data={summary.pagamentos} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankList
              title="Mais vendidos"
              rows={summary.topProdutos.map((p) => ({
                label: p.name,
                meta: `${p.qty} un.`,
                value: brl(p.revenue),
              }))}
            />
            <RankList
              title="Ranking de vendedores"
              rows={summary.vendedores.map((v) => ({
                label: v.name,
                meta: `${v.vendas} venda(s)`,
                value: brl(v.total),
              }))}
            />
          </div>

          {cashflow && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Fluxo de caixa
                    <span className="ml-2 font-normal text-slate-400">
                      entradas × saídas (14 dias)
                    </span>
                  </h2>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ↑ {brl(cashflow.totalEntradas)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      ↓ {brl(cashflow.totalSaidas)}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      = {brl(cashflow.saldo)}
                    </span>
                  </div>
                </div>
                <CashflowChart data={cashflow.series} />
              </div>
              <DreCard dre={cashflow.dre} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DreCard({ dre }: { dre: DRE }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        DRE simplificado
        <span className="ml-2 font-normal text-slate-400">30 dias</span>
      </h2>
      <div className="space-y-1.5 text-sm">
        <DreLine label="Receita de vendas" value={dre.receita} />
        <DreLine label="(−) CMV" value={-dre.cmv} muted />
        <DreLine label="= Lucro bruto" value={dre.lucroBruto} bold />
        <p className="pl-1 text-xs text-slate-400">
          Margem bruta {dre.margemBruta}%
        </p>
        <DreLine label="(−) Despesas" value={-dre.despesas} muted />
        <div className="mt-1 border-t border-slate-100 pt-2 dark:border-ink-800">
          <DreLine label="= Resultado" value={dre.resultado} bold result />
        </div>
      </div>
    </div>
  );
}

function DreLine({
  label,
  value,
  bold,
  muted,
  result,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  result?: boolean;
}) {
  const brlv = value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return (
    <div className="flex justify-between">
      <span
        className={`${bold ? "font-semibold text-slate-700 dark:text-slate-200" : muted ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          result
            ? value >= 0
              ? "font-bold text-emerald-600 dark:text-emerald-400"
              : "font-bold text-red-600 dark:text-red-400"
            : bold
              ? "font-semibold text-slate-700 dark:text-slate-200"
              : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {brlv}
      </span>
    </div>
  );
}
