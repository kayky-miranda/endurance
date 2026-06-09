"use client";

import { useState } from "react";
import { Calculator, ArrowRight } from "lucide-react";

export type SimProduct = {
  id: string;
  name: string;
  price: number;
  cost: number;
  soldPerDay: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function PricingSimulator({
  products,
}: {
  products: SimProduct[];
}) {
  const [id, setId] = useState(products[0]?.id ?? "");
  const p = products.find((x) => x.id === id) ?? products[0];
  const [priceStr, setPriceStr] = useState(p ? String(p.price) : "");

  if (!p) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        Cadastre produtos para simular preços.
      </div>
    );
  }

  const newPrice = parseFloat(priceStr.replace(",", ".")) || 0;
  const monthlyUnits = p.soldPerDay * 30;
  const curMargin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
  const newMargin = newPrice > 0 ? ((newPrice - p.cost) / newPrice) * 100 : 0;
  const curProfit = monthlyUnits * (p.price - p.cost);
  const newProfit = monthlyUnits * (newPrice - p.cost);
  const delta = newProfit - curProfit;

  function selectProduct(pid: string) {
    setId(pid);
    const np = products.find((x) => x.id === pid);
    if (np) setPriceStr(String(np.price));
  }
  function applyPct(factor: number) {
    setPriceStr((p.price * factor).toFixed(2));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Calculator className="h-4 w-4 text-brand-500" />
        Simulador de preço
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Produto</label>
          <select
            value={id}
            onChange={(e) => selectProduct(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          >
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Custo {brl(p.cost)} · vende {p.soldPerDay}/dia
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Novo preço</label>
          <input
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
          <div className="mt-1.5 flex gap-1.5">
            {[
              { l: "-20%", f: 0.8 },
              { l: "-10%", f: 0.9 },
              { l: "preço atual", f: 1 },
              { l: "+10%", f: 1.1 },
            ].map((b) => (
              <button
                key={b.l}
                onClick={() => applyPct(b.f)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-400"
              >
                {b.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SimStat
          label="Margem"
          from={pct(curMargin)}
          to={pct(newMargin)}
          good={newMargin >= curMargin}
        />
        <SimStat
          label="Lucro / mês"
          from={brl(curProfit)}
          to={brl(newProfit)}
          good={newProfit >= curProfit}
        />
        <div className="rounded-xl border border-slate-200 p-3 dark:border-ink-700">
          <p className="text-xs text-slate-500">Variação no lucro/mês</p>
          <p
            className={`mt-1 text-lg font-bold ${
              delta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {brl(delta)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Estimativa assumindo o mesmo volume de vendas atual.
      </p>
    </div>
  );
}

function SimStat({
  label,
  from,
  to,
  good,
}: {
  label: string;
  from: string;
  to: string;
  good: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-ink-700">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="text-slate-400">{from}</span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        <span
          className={`font-bold ${
            good
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {to}
        </span>
      </div>
    </div>
  );
}
