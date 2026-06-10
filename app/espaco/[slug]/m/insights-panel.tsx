"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import { salesInsightsAction } from "./reports-actions";
import type { Insight } from "@/lib/endurance/sales-insights";

const STYLE: Record<
  string,
  { icon: typeof Info; ring: string; text: string }
> = {
  oportunidade: {
    icon: TrendingUp,
    ring: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  alerta: {
    icon: AlertTriangle,
    ring: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    ring: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    text: "text-brand-600 dark:text-brand-300",
  },
};

export default function InsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await salesInsightsAction();
    if (res.ok) {
      setInsights(res.insights);
      setSource(res.source);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
          <Sparkles className="h-4 w-4" />
          Insights da IA
          {source && (
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-normal text-slate-500 dark:bg-ink-900/60">
              {source === "ai" ? "Gemini" : "automático"}
            </span>
          )}
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:text-brand-500 disabled:opacity-40"
          title="Recarregar insights"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Analisando suas vendas…
        </p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {insights.map((it, i) => {
            const st = STYLE[it.kind] ?? STYLE.info;
            const Icon = st.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900"
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${st.ring}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {it.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {it.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
