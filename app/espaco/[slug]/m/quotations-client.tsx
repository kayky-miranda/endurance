"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  GitCompare,
  Star,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { QuotationRow } from "@/lib/endurance/quotations";
import { quotationStatusLabel } from "@/lib/endurance/quotation-status";
import { createQuotationAction } from "./quotations-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ReqOpt = { id: string; number: string; itemsCount: number; estimatedTotal: number };
type SupplierOpt = { id: string; name: string; rating: number; leadTimeDays: number };

export default function QuotationsClient({
  slug,
  rows,
  meta,
  requisitions,
  suppliers,
}: {
  slug: string;
  rows: QuotationRow[];
  meta: PageMeta;
  requisitions: ReqOpt[];
  suppliers: SupplierOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requisitionId, setRequisitionId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function create() {
    if (busy) return;
    if (!requisitionId) return setError("Escolha uma solicitação aprovada.");
    if (picked.length === 0) return setError("Selecione ao menos um fornecedor.");
    setBusy(true);
    setError("");
    const res = await createQuotationAction({
      requisitionId,
      supplierIds: picked,
    });
    setBusy(false);
    if (res.ok && res.id) {
      router.push(`/espaco/${slug}/m/cotacoes/${res.id}`);
    } else {
      setError(res.error ?? "Erro ao criar cotação.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compare propostas de vários fornecedores e escolha a melhor.
        </p>
        <button
          onClick={() => {
            setOpen(true);
            setError("");
            setRequisitionId("");
            setPicked([]);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" />
          Nova cotação
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <GitCompare className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhuma cotação ainda
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crie uma cotação a partir de uma solicitação aprovada.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Cotação</th>
                  <th className="px-5 py-2.5 font-medium">Fornecedores</th>
                  <th className="px-5 py-2.5 font-medium">Itens</th>
                  <th className="px-5 py-2.5 font-medium">Vencedor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/espaco/${slug}/m/cotacoes/${q.id}`}
                        className="font-mono font-medium text-slate-700 hover:text-brand-500 dark:text-slate-200"
                      >
                        {q.number}
                      </Link>
                      <p className="text-xs text-slate-400">{q.createdAt}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {q.suppliers}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {q.items}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {q.winner || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <QStatusBadge status={q.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/espaco/${slug}/m/cotacoes/${q.id}`}
                        className="text-xs font-medium text-brand-500 hover:underline"
                      >
                        Comparar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager param="pagina" meta={meta} />

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-ink-800">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Nova cotação
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Solicitação aprovada
                </label>
                {requisitions.length === 0 ? (
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                    Nenhuma solicitação aprovada disponível. Aprove uma solicitação
                    primeiro.
                  </p>
                ) : (
                  <select
                    value={requisitionId}
                    aria-label="Requisição de origem"
                    onChange={(e) => setRequisitionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                  >
                    <option value="">— Escolha a solicitação —</option>
                    {requisitions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} · {r.itemsCount} itens · {brl(r.estimatedTotal)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Fornecedores a cotar ({picked.length})
                </label>
                {suppliers.length === 0 ? (
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                    Cadastre fornecedores ativos primeiro.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {suppliers.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 transition hover:border-brand-500/50 dark:border-ink-700"
                      >
                        <input
                          type="checkbox"
                          checked={picked.includes(s.id)}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4 accent-brand-500"
                        />
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                          {s.name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {s.rating.toFixed(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-ink-800">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800"
              >
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Criar e cotar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberta: "bg-slate-400/15 text-slate-500",
    respondida: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    fechada: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    cancelada: "bg-red-500/15 text-red-500",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.aberta}`}>
      {quotationStatusLabel(status)}
    </span>
  );
}
