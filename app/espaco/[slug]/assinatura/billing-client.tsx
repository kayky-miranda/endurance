"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Check,
  Crown,
  AlertTriangle,
  Loader2,
  Users,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  XCircle,
  Receipt,
} from "lucide-react";
import {
  formatPlanPrice,
  seatsLabel,
  statusLabel,
  planLabel,
  type PlanDef,
  type PlanId,
  type BillingView,
  type InvoiceView,
} from "@/lib/endurance/billing";
import {
  changePlanAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "./billing-actions";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_TONE: Record<string, string> = {
  active:
    "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300",
  trialing: "bg-brand-500/15 text-brand-600 ring-brand-500/30 dark:text-brand-300",
  past_due: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
  canceled: "bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-300",
};

const INVOICE_TONE: Record<string, string> = {
  paga: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  pendente: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  falhou: "bg-red-500/15 text-red-600 dark:text-red-300",
};

const PLAN_ORDER: PlanId[] = [
  "starter",
  "professional",
  "business",
  "enterprise",
];

export default function BillingClient({
  plans,
  billing,
  invoices,
  seatsUsed,
}: {
  slug: string;
  plans: PlanDef[];
  billing: BillingView;
  invoices: InvoiceView[];
  seatsUsed: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const current = plans.find((p) => p.id === billing.plan) ?? plans[0];
  const seatLimit = current.seats; // 0 = ilimitado
  const overSeats = seatLimit > 0 && seatsUsed > seatLimit;
  const seatPct =
    seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, plan?: string) {
    setMsg(null);
    setBusyPlan(plan ?? "__sub__");
    startTransition(async () => {
      const res = await fn();
      setBusyPlan(null);
      if (res.ok) {
        setMsg({ tone: "ok", text: "Assinatura atualizada." });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: res.error ?? "Não foi possível concluir." });
      }
    });
  }

  function rank(id: PlanId): number {
    return PLAN_ORDER.indexOf(id);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/30">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plano e cobrança</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gerencie o plano contratado, os limites do espaço e as faturas.
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Resumo da assinatura */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Plano atual
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold">{current.name}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                  STATUS_TONE[billing.status] ?? STATUS_TONE.active
                }`}
              >
                {statusLabel(billing.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {formatPlanPrice(current.priceMonthly)}
              {current.priceMonthly ? " /mês" : ""}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <CalendarClock className="h-4 w-4" />
              {billing.cancelAtPeriodEnd ? "Acesso até" : "Renova em"}{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatDate(billing.currentPeriodEnd)}
              </span>
            </span>
            {billing.virtual && (
              <span className="text-xs text-slate-400">
                Período de avaliação — escolha um plano para ativar.
              </span>
            )}
          </div>
        </div>

        {/* Uso de assentos */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Users className="h-4 w-4" /> Usuários
            </span>
            <span
              className={
                overSeats
                  ? "font-semibold text-red-600 dark:text-red-300"
                  : "text-slate-500 dark:text-slate-400"
              }
            >
              {seatsUsed} de {seatsLabel(seatLimit)}
            </span>
          </div>
          {seatLimit > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800">
              <div
                className={`h-full rounded-full ${
                  overSeats ? "bg-red-500" : "bg-brand-500"
                }`}
                style={{ width: `${Math.max(6, seatPct)}%` }}
              />
            </div>
          )}
          {overSeats && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Você ultrapassou o limite do plano. Faça upgrade para regularizar.
            </p>
          )}
        </div>

        {/* Cancelamento / reativação */}
        {!billing.virtual && (
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-ink-800">
            {billing.cancelAtPeriodEnd ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-sm text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Renovação cancelada — o acesso encerra em{" "}
                  {formatDate(billing.currentPeriodEnd)}.
                </p>
                <button
                  onClick={() => run(resumeSubscriptionAction)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {pending && busyPlan === "__sub__" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Reativar renovação
                </button>
              </div>
            ) : (
              <button
                onClick={() => run(cancelSubscriptionAction)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-ink-700 dark:text-slate-300"
              >
                {pending && busyPlan === "__sub__" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Cancelar assinatura
              </button>
            )}
          </div>
        )}
      </section>

      {/* Comparativo de planos */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Escolha seu plano</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.id === billing.plan && !billing.virtual;
            const direction = rank(p.id) - rank(billing.plan);
            const busy = pending && busyPlan === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 dark:bg-ink-900 ${
                  isCurrent
                    ? "border-brand-500 ring-1 ring-brand-500"
                    : p.featured
                      ? "border-brand-300 dark:border-brand-500/40"
                      : "border-slate-200 dark:border-ink-800"
                }`}
              >
                {p.featured && !isCurrent && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <Crown className="h-3 w-3" /> Recomendado
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-2.5 left-5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Plano atual
                  </span>
                )}

                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {p.name}
                </p>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {formatPlanPrice(p.priceMonthly)}
                  </span>
                  {p.priceMonthly ? (
                    <span className="text-xs text-slate-400">/mês</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {p.description}
                </p>

                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span className="text-slate-600 dark:text-slate-300">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-400 dark:border-ink-700"
                    >
                      Plano atual
                    </button>
                  ) : p.contactSales ? (
                    <a
                      href="mailto:vendas@endurance.app?subject=Plano%20Enterprise"
                      className="block w-full rounded-lg border border-slate-200 py-2 text-center text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-700 dark:text-slate-300"
                    >
                      Falar com vendas
                    </a>
                  ) : (
                    <button
                      onClick={() => run(() => changePlanAction(p.id), p.id)}
                      disabled={pending}
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition disabled:opacity-60 ${
                        p.featured
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "border border-slate-200 text-slate-700 hover:border-brand-500 hover:text-brand-500 dark:border-ink-700 dark:text-slate-200"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : direction > 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {direction > 0 ? "Fazer upgrade" : "Mudar plano"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Histórico de faturas */}
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-ink-800">
          <Receipt className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold">Histórico de faturas</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            Nenhuma fatura emitida ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3 font-medium">Fatura</th>
                  <th className="px-6 py-3 font-medium">Plano</th>
                  <th className="px-6 py-3 font-medium">Período</th>
                  <th className="px-6 py-3 font-medium">Emitida</th>
                  <th className="px-6 py-3 text-right font-medium">Valor</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {inv.number}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                      {planLabel(inv.plan)}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    </td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(inv.issuedAt)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                      {BRL.format(inv.amount)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          INVOICE_TONE[inv.status] ?? INVOICE_TONE.pendente
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
