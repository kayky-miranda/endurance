"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Wallet,
  ClipboardCheck,
} from "lucide-react";
import {
  openCashAction,
  addMovementAction,
  closeCashAction,
} from "./caixa-actions";
import type { CaixaOverview } from "@/lib/endurance/cash";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function CaixaClient({ overview }: { overview: CaixaOverview }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Falha na operação.");
    });
  }

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      {overview.open ? (
        <OpenPanel open={overview.open} pending={pending} run={run} />
      ) : (
        <OpenForm pending={pending} run={run} />
      )}

      {overview.others.length > 0 && <OtherCaixas rows={overview.others} />}

      <History rows={overview.history} />
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>) => void;

function OpenForm({ pending, run }: { pending: boolean; run: RunFn }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-1 flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Caixa fechado</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Abra o caixa com o fundo de troco para iniciar as vendas.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-slate-500">
            Fundo de troco (abertura)
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls}
          />
        </label>
        <button
          onClick={() =>
            run(() =>
              openCashAction(parseFloat(amount.replace(",", ".")) || 0),
            )
          }
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
          Abrir caixa
        </button>
      </div>
    </div>
  );
}

function OpenPanel({
  open,
  pending,
  run,
}: {
  open: NonNullable<CaixaOverview["open"]>;
  pending: boolean;
  run: RunFn;
}) {
  const b = open.breakdown;
  return (
    <>
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Unlock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Caixa aberto
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {open.openedBy} · desde {open.openedAt}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Esperado em dinheiro</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {brl(b.expected)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Line label="Abertura" value={brl(b.opening)} />
          <Line label="Vendas dinheiro" value={brl(b.cashSales)} pos />
          <Line label="Suprimentos" value={brl(b.suprimentos)} pos />
          <Line label="Sangrias" value={`- ${brl(b.sangrias)}`} neg />
          <Line label="Faturamento" value={brl(b.salesTotal)} />
          <Line label="Vendas" value={String(b.salesCount)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MovementForm pending={pending} run={run} />
        <CloseForm expected={b.expected} pending={pending} run={run} />
      </div>

      {open.movements.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Movimentações do turno
          </p>
          <div className="divide-y divide-slate-100 dark:divide-ink-800">
            {open.movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                {m.type === "suprimento" ? (
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                  {m.type}
                </span>
                <span className="text-slate-400">{m.reason || "—"}</span>
                <span className="ml-auto text-slate-400">{m.quando}</span>
                <span
                  className={`w-24 text-right font-medium ${
                    m.type === "suprimento"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {m.type === "suprimento" ? "+" : "-"} {brl(m.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function MovementForm({ pending, run }: { pending: boolean; run: RunFn }) {
  const [type, setType] = useState<"suprimento" | "sangria">("sangria");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Wallet className="h-4 w-4 text-brand-500" />
        Movimentar caixa
      </h2>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setType("sangria")}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
            type === "sangria"
              ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-slate-200 text-slate-500 dark:border-ink-600"
          }`}
        >
          Sangria (retirada)
        </button>
        <button
          onClick={() => setType("suprimento")}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
            type === "suprimento"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-slate-200 text-slate-500 dark:border-ink-600"
          }`}
        >
          Suprimento (reforço)
        </button>
      </div>
      <div className="space-y-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Valor (R$)"
          className={inputCls}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (ex.: troco, pagamento fornecedor)"
          className={inputCls}
        />
        <button
          onClick={() => {
            run(() =>
              addMovementAction(
                type,
                parseFloat(amount.replace(",", ".")) || 0,
                reason,
              ),
            );
            setAmount("");
            setReason("");
          }}
          disabled={pending}
          className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          Registrar {type}
        </button>
      </div>
    </div>
  );
}

function CloseForm({
  expected,
  pending,
  run,
}: {
  expected: number;
  pending: boolean;
  run: RunFn;
}) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const c = parseFloat(counted.replace(",", ".")) || 0;
  const diff = counted === "" ? null : Math.round((c - expected) * 100) / 100;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <ClipboardCheck className="h-4 w-4 text-brand-500" />
        Fechar caixa (conferência)
      </h2>
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Dinheiro contado na gaveta
          </span>
          <input
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls}
          />
        </label>
        {diff !== null && (
          <div
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
              Math.abs(diff) < 0.01
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : diff > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            <span>
              {Math.abs(diff) < 0.01
                ? "Caixa confere"
                : diff > 0
                  ? "Sobra"
                  : "Falta"}
            </span>
            <span className="font-bold">
              {diff >= 0 ? "+" : ""}
              {brl(diff)}
            </span>
          </div>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          className={inputCls}
        />
        <button
          onClick={() => run(() => closeCashAction(c, note))}
          disabled={pending || counted === ""}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Fechar caixa
        </button>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  pos,
  neg,
}: {
  label: string;
  value: string;
  pos?: boolean;
  neg?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          pos
            ? "text-emerald-600 dark:text-emerald-400"
            : neg
              ? "text-red-600 dark:text-red-400"
              : "text-slate-700 dark:text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function OtherCaixas({ rows }: { rows: CaixaOverview["others"] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Wallet className="h-4 w-4 text-brand-500" />
        Outros caixas abertos
        <span className="font-normal text-slate-400">(equipe)</span>
      </h2>
      <div className="divide-y divide-slate-100 dark:divide-ink-800">
        {rows.map((o) => (
          <div key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
            <Unlock className="h-4 w-4 text-emerald-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {o.operator}
            </span>
            <span className="text-slate-400">desde {o.openedAt}</span>
            <span className="ml-auto font-medium text-slate-600 dark:text-slate-300">
              {brl(o.expected)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function History({ rows }: { rows: CaixaOverview["history"] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Histórico de fechamentos
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Operador</th>
              <th className="px-5 py-2.5 font-medium">Abertura</th>
              <th className="px-5 py-2.5 font-medium">Fechamento</th>
              <th className="px-5 py-2.5 font-medium">Esperado</th>
              <th className="px-5 py-2.5 font-medium">Contado</th>
              <th className="px-5 py-2.5 font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 last:border-0 dark:border-ink-800"
              >
                <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                  {r.operator}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.openedAt}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {r.closedAt}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {brl(r.expectedAmount)}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {brl(r.countedAmount)}
                </td>
                <td
                  className={`px-5 py-3 font-medium ${
                    Math.abs(r.difference) < 0.01
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {r.difference >= 0 ? "+" : ""}
                  {brl(r.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
