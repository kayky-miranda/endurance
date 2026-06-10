"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Check, CheckCircle2, Download, FileText } from "lucide-react";
import Link from "next/link";
import { markPaidAction, createEntryAction } from "./finance-actions";
import type { FinanceRow } from "@/lib/endurance/finance";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function FinanceClient({
  slug,
  receber,
  pagar,
}: {
  slug: string;
  receber: FinanceRow[];
  pagar: FinanceRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"receber" | "pagar">("receber");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = tab === "receber" ? receber : pagar;

  async function markPaid(id: string) {
    setBusy(id);
    setErr(null);
    const res = await markPaidAction(id);
    setBusy(null);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "Falha ao baixar.");
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-ink-700">
          {(["receber", "pagar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-brand-500 text-white"
                  : "text-slate-500 hover:text-brand-500 dark:text-slate-400"
              }`}
            >
              {t === "receber" ? "A receber" : "A pagar"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/espaco/${slug}/relatorio/financeiro`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Link>
          <a
            href={`/espaco/${slug}/export/financeiro`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
        </div>
      </div>

      {showForm && (
        <EntryForm
          defaultKind={tab}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                <th className="px-5 py-2.5 font-medium">Descrição</th>
                <th className="px-5 py-2.5 font-medium">Categoria</th>
                <th className="px-5 py-2.5 font-medium">Vencimento</th>
                <th className="px-5 py-2.5 font-medium">Valor</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Nenhum lançamento.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {r.description}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {r.category}
                  </td>
                  <td
                    className={`px-5 py-3 ${
                      r.overdue
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {r.dueDate}
                    {r.overdue && " · vencido"}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {brl(r.amount)}
                  </td>
                  <td className="px-5 py-3">
                    {r.status === "pago" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {tab === "receber" ? "Recebido" : "Pago"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.status === "pendente" && (
                      <button
                        onClick={() => markPaid(r.id)}
                        disabled={busy === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-40 dark:border-emerald-500/30 dark:text-emerald-400"
                      >
                        {busy === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {tab === "receber" ? "Receber" : "Pagar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EntryForm({
  defaultKind,
  onSaved,
}: {
  defaultKind: "receber" | "pagar";
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"receber" | "pagar">(defaultKind);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await createEntryAction({
        kind,
        description,
        category,
        amount: parseFloat(amount.replace(",", ".")) || 0,
        dueDate,
      });
      if (res.ok) onSaved();
      else setErr(res.error ?? "Falha ao salvar.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "receber" | "pagar")}
            className={inputCls}
          >
            <option value="receber">A receber</option>
            <option value="pagar">A pagar</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Vencimento</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Aluguel da loja"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Categoria</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex.: Despesa fixa"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Valor (R$)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls}
          />
        </label>
      </div>
      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar lançamento
        </button>
      </div>
    </div>
  );
}
