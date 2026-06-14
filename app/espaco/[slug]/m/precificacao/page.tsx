import Link from "next/link";
import { AlertTriangle, DollarSign, Percent } from "lucide-react";
import { getPricingAnalysis, type PricingRow } from "@/lib/endurance/pricing";
import PricingAdvicePanel from "../pricing-advice-panel";
import PricingSimulator from "../pricing-simulator";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Precificação inteligente: margens, preços e promoções (varejo).
export default async function PrecificacaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "precificacao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const analysis = session ? await getPricingAnalysis(session.org, 30) : null;
  const simProducts = analysis
    ? analysis.rows.map((r) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        cost: r.cost,
        soldPerDay: r.soldPerDay,
      }))
    : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!analysis || analysis.rows.length === 0 ? (
        <EmptyCard>
          Cadastre produtos com preço e custo no{" "}
          <Link
            href={`/espaco/${slug}/m/produtos`}
            className="font-medium text-brand-500 hover:underline"
          >
            Cadastro de produtos
          </Link>{" "}
          para liberar a análise.
        </EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              icon={Percent}
              label="Margem média"
              value={`${analysis.avgMargin}%`}
              from="from-cyan-500"
              to="to-cyan-600"
            />
            <KpiCard
              icon={DollarSign}
              label="Lucro bruto (30d)"
              value={brl(analysis.grossProfit)}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Margem baixa/negativa"
              value={String(analysis.lowMarginCount)}
              from="from-amber-500"
              to="to-amber-600"
            />
          </div>

          <PricingAdvicePanel />
          <PricingSimulator products={simProducts} />
          <MarginTable rows={analysis.rows} />
        </>
      )}
    </div>
  );
}

const MARGIN_STYLE: Record<string, { label: string; cls: string }> = {
  negativa: {
    label: "Negativa",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  baixa: {
    label: "Baixa",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ok: {
    label: "Saudável",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
};

function MarginTable({ rows }: { rows: PricingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Margem por produto
        <span className="ml-2 font-normal text-slate-400">
          últimos 30 dias · piores margens primeiro
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Produto</th>
              <th className="px-5 py-2.5 font-medium">Preço</th>
              <th className="px-5 py-2.5 font-medium">Custo</th>
              <th className="px-5 py-2.5 font-medium">Margem</th>
              <th className="px-5 py-2.5 font-medium">Vendidos</th>
              <th className="px-5 py-2.5 font-medium">Lucro (30d)</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = MARGIN_STYLE[r.level] ?? MARGIN_STYLE.ok;
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {r.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {brl(r.price)}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {brl(r.cost)}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {r.margin}%
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {r.soldQty}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {brl(r.profit)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
