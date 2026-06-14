"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import {
  markPaidAction,
  createEntryAction,
  markReconciledAction,
} from "./finance-actions";
import type { FinanceRow } from "@/lib/endurance/finance";
import type { ReconOverview, ReconStatus } from "@/lib/endurance/reconciliation";
import type { PageMeta } from "@/lib/endurance/pagination";
import Pager from "./pager";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function FinanceClient({
  slug,
  receber,
  pagar,
  receberMeta,
  pagarMeta,
  conciliacao,
}: {
  slug: string;
  receber: FinanceRow[];
  pagar: FinanceRow[];
  receberMeta: PageMeta;
  pagarMeta: PageMeta;
  conciliacao: ReconOverview | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"receber" | "pagar" | "conciliacao">("receber");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = tab === "receber" ? receber : pagar;
  const meta = tab === "receber" ? receberMeta : pagarMeta;

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
          {(["receber", "pagar", "conciliacao"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-brand-500 text-white"
                  : "text-slate-500 hover:text-brand-500 dark:text-slate-400"
              }`}
            >
              {t === "receber"
                ? "A receber"
                : t === "pagar"
                  ? "A pagar"
                  : "Conciliação PIX"}
            </button>
          ))}
        </div>
        <div
          className={`flex items-center gap-2 ${tab === "conciliacao" ? "hidden" : ""}`}
        >
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

      {tab === "conciliacao" ? (
        <ReconPanel data={conciliacao} />
      ) : (
        <>
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

      <Pager param={tab === "receber" ? "rec" : "pag"} meta={meta} />
        </>
      )}
    </div>
  );
}

const RECON_BADGE: Record<
  ReconStatus,
  { label: string; cls: string }
> = {
  conciliado: {
    label: "Conciliado",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  divergente: {
    label: "Divergente",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  pago_sem_venda: {
    label: "Pago sem venda",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  pendente: {
    label: "Pendente",
    cls: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  },
  expirado: {
    label: "Expirado",
    cls: "bg-slate-500/15 text-slate-400",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-slate-500/15 text-slate-400",
  },
};

/** Painel de conciliação PIX: cobranças × vendas × recebíveis. */
function ReconPanel({ data }: { data: ReconOverview | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return null;

  async function reconcile(id: string) {
    setBusy(id);
    await markReconciledAction(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReconKpi
          icon={CheckCircle2}
          label="Recebido em PIX"
          value={brl(data.kpis.recebidoPix)}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <ReconKpi
          icon={Link2}
          label="Conciliados"
          value={String(data.kpis.conciliados)}
          tone="text-slate-700 dark:text-slate-200"
        />
        <ReconKpi
          icon={AlertTriangle}
          label="Pago sem venda"
          value={String(data.kpis.pagoSemVenda)}
          tone="text-amber-600 dark:text-amber-400"
        />
        <ReconKpi
          icon={Clock}
          label="Aguardando"
          value={String(data.kpis.pendentes)}
          tone="text-slate-500 dark:text-slate-400"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                <th className="px-5 py-2.5 font-medium">Criada</th>
                <th className="px-5 py-2.5 font-medium">Venda</th>
                <th className="px-5 py-2.5 font-medium">Provedor</th>
                <th className="px-5 py-2.5 font-medium">Valor</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Nenhuma cobrança PIX ainda.
                  </td>
                </tr>
              )}
              {data.rows.map((r) => {
                const badge = RECON_BADGE[r.status];
                const divergente = r.status === "divergente";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                  >
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {r.createdAt}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {r.saleCode ?? "—"}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-500 dark:text-slate-400">
                      {r.provider}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {brl(r.amount)}
                      {divergente && r.receivableAmount != null && (
                        <span className="ml-1 text-xs text-red-500">
                          (venda {brl(r.receivableAmount)})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.status === "pago_sem_venda" && (
                        <button
                          onClick={() => reconcile(r.id)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
                        >
                          {busy === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Conciliar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pager param="con" meta={data.meta} />
    </div>
  );
}

function ReconKpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
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
