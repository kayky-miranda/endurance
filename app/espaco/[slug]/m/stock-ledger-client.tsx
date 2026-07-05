"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  History,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { StockMovementRow } from "@/lib/endurance/stock-ledger";
import { recordManualMovementAction } from "./stock-actions";

type Product = { id: string; name: string; stock: number };
type Reason = { id: string; label: string; dir: string };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function StockLedgerClient({
  slug,
  rows,
  meta,
  products,
  reasons,
  filterType,
  filterProduct,
}: {
  slug: string;
  rows: StockMovementRow[];
  meta: PageMeta;
  products: Product[];
  reasons: Reason[];
  filterType: string;
  filterProduct: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState(reasons[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("pagina");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function save() {
    if (busy) return;
    if (!productId) return setError("Escolha um produto.");
    setBusy(true);
    setError("");
    const res = await recordManualMovementAction({
      productId,
      reason,
      quantity: parseInt(qty, 10) || 0,
      note,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setProductId("");
      setQty("");
      setNote("");
      router.refresh();
    } else setError(res.error ?? "Erro ao lançar movimentação.");
  }

  return (
    <div className="space-y-4">
      {/* Filtros + ação */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterProduct}
            onChange={(e) => setFilter("produto", e.target.value)}
            className={`${inputCls} sm:w-52`}
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-ink-600">
            {[
              { id: "", label: "Tudo" },
              { id: "entrada", label: "Entradas" },
              { id: "saida", label: "Saídas" },
              { id: "ajuste", label: "Ajustes" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter("tipo", t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === t.id
                    ? "bg-brand-500 text-ink-950"
                    : "text-slate-500 hover:text-brand-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setError("");
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" />
          Nova movimentação
        </button>
      </div>

      {/* Razão (tabela de auditoria) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <History className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhuma movimentação registrada
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Vendas, recebimentos e lançamentos manuais aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-4 py-2.5 font-medium">Data/hora</th>
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="px-4 py-2.5 font-medium">Motivo</th>
                  <th className="px-4 py-2.5 font-medium text-right">Qtd</th>
                  <th className="px-4 py-2.5 font-medium text-right">Saldo ant.</th>
                  <th className="px-4 py-2.5 font-medium text-right">Saldo pos.</th>
                  <th className="px-4 py-2.5 font-medium">Documento</th>
                  <th className="px-4 py-2.5 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {m.createdAt}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      {m.product}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        {m.type === "entrada" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                        ) : m.type === "saida" ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                        ) : (
                          <Sliders className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {m.reason}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${
                        m.quantity > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {m.balanceBefore}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700 dark:text-slate-200">
                      {m.balanceAfter}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {m.document}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {m.user}
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
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-ink-800">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Nova movimentação
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Produto
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Escolha o produto —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (saldo {p.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Motivo
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputCls}
                >
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.dir === "in" ? "entrada" : "saída"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Quantidade
                </label>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Observação
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={`${inputCls} min-h-16`}
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
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
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Lançar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
