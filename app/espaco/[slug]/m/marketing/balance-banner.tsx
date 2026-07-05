"use client";

import { AlertCircle, CreditCard } from "lucide-react";
import type { BalanceInfo } from "./types";

const PLAN_LABELS: Record<string, string> = {
  trial: "Teste gratuito",
  basico: "Básico",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function BalanceBanner({
  info,
  onPlans,
}: {
  info: BalanceInfo;
  onPlans: () => void;
}) {
  const isTrialEnded = info.status === "trial_ended";
  const isTrial = info.plan === "trial";
  const daysLeft = info.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(info.trialEndsAt).getTime() - Date.now()) / 86400_000,
        ),
      )
    : 0;

  if (isTrialEnded) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Teste encerrado
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              Assine um plano para continuar criando carrosséis.
            </p>
          </div>
        </div>
        <button
          onClick={onPlans}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Ver planos
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-4 text-white shadow">
      <div>
        <p className="text-sm font-semibold">
          {PLAN_LABELS[info.plan] ?? info.plan}
          {isTrial && daysLeft > 0 && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {daysLeft}d restantes
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-white/80">
          {info.unlimited
            ? "Carrosséis ilimitados"
            : `${info.balance} crédito${info.balance !== 1 ? "s" : ""} disponível${info.balance !== 1 ? "s" : ""}`}
        </p>
      </div>
      <button
        onClick={onPlans}
        className="rounded-xl bg-white/20 px-4 py-2 text-xs font-semibold hover:bg-white/30"
      >
        <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />
        Planos
      </button>
    </div>
  );
}
