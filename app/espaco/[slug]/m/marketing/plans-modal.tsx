"use client";

import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import type { PlanDef } from "@/lib/endurance/marketing/plans";
import { brl } from "./helpers";

export function PlansModal({
  plans,
  current,
  onClose,
  onChanged,
}: {
  plans: PlanDef[];
  current: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function select(planId: string) {
    setLoading(planId);
    await fetch("/api/marketing/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_plan", planId }),
    });
    setLoading(null);
    onChanged();
    onClose();
  }

  const paid = plans.filter((p) => p.id !== "trial");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Planos de Marketing</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {paid.map((p) => {
            const isCurrent = p.id === current;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 ${isCurrent ? "border-brand-500 bg-brand-500/5" : "border-slate-200 dark:border-ink-700"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                  {p.label}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {brl(p.priceMonthly)}
                  <span className="text-sm font-normal text-slate-400">/mês</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => select(p.id)}
                  disabled={isCurrent || loading === p.id}
                  className={`mt-4 w-full rounded-xl py-2 text-sm font-semibold transition ${
                    isCurrent
                      ? "bg-brand-500 text-white opacity-60"
                      : "bg-brand-500 text-white hover:bg-brand-600"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {loading === p.id ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : (
                    "Assinar"
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Pagamento simulado — sem cobrança real no protótipo.
        </p>
      </div>
    </div>
  );
}
