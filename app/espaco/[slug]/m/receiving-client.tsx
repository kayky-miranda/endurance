"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  PackageCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { ReceivableRow } from "@/lib/endurance/receiving";
import type { ReceivingTarget } from "@/lib/endurance/receiving";
import { poStatusLabel } from "@/lib/endurance/purchase-order-status";
import {
  loadReceivingTargetAction,
  receiveOrderAction,
} from "./receiving-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Receipt = {
  id: string;
  number: string;
  status: string;
  receivedBy: string;
  createdAt: string;
  items: { name: string; qtyReceived: number; qtyOrdered: number; qualityOk: boolean }[];
};

type LineDraft = { qty: string; qualityOk: boolean; note: string };

export default function ReceivingClient({
  slug,
  rows,
  meta,
}: {
  slug: string;
  rows: ReceivableRow[];
  meta: PageMeta;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ReceivingTarget | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [draft, setDraft] = useState<Record<string, LineDraft>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function openOrder(id: string) {
    setOpen(true);
    setTarget(null);
    setNote("");
    const res = await loadReceivingTargetAction(id);
    if (res.ok && res.target) {
      setTarget(res.target);
      setReceipts(res.receipts ?? []);
      // Pré-preenche cada linha com o que ainda falta (recebimento total padrão).
      const d: Record<string, LineDraft> = {};
      for (const it of res.target.items)
        d[it.id] = { qty: String(it.remaining), qualityOk: true, note: "" };
      setDraft(d);
    } else {
      setOpen(false);
      alert(res.error);
    }
  }

  function setLine(id: string, patch: Partial<LineDraft>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function confirm() {
    if (!target || busy) return;
    const lines = target.items
      .map((it) => ({
        orderItemId: it.id,
        qtyReceived: parseInt(draft[it.id]?.qty ?? "0", 10) || 0,
        qualityOk: draft[it.id]?.qualityOk !== false,
        note: draft[it.id]?.note ?? "",
      }))
      .filter((l) => l.qtyReceived > 0);
    if (lines.length === 0) {
      alert("Informe ao menos uma quantidade recebida.");
      return;
    }
    setBusy(true);
    const res = await receiveOrderAction(target.id, lines, note);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      const msg =
        res.status === "recebido"
          ? "Pedido recebido por completo."
          : "Recebimento parcial registrado.";
      alert(
        `${msg}${res.payable ? ` Conta a pagar gerada: ${brl(res.payable)}.` : ""} Estoque atualizado.`,
      );
    } else alert(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <PackageCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nada a receber
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Pedidos confirmados aparecem aqui para conferência.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Pedido</th>
                  <th className="px-5 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-5 py-2.5 font-medium">Itens</th>
                  <th className="px-5 py-2.5 font-medium">Entrega prev.</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40"
                  >
                    <td className="px-5 py-3 font-mono font-medium text-slate-700 dark:text-slate-200">
                      {o.code}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {o.supplier}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {o.receivedItems}/{o.itemsCount} recebidos
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {o.expectedDate ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.status === "parcial"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-brand-500/15 text-brand-600 dark:text-brand-400"
                        }`}
                      >
                        {poStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openOrder(o.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Receber
                      </button>
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
          <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-ink-800">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {target ? `Receber ${target.code}` : "Carregando…"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!target ? (
              <div className="grid flex-1 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Confira a quantidade recebida de cada item. Itens fora do padrão
                    de qualidade podem ser desmarcados (não entram no estoque).
                  </p>

                  <div className="space-y-3">
                    {target.items.map((it) => {
                      const d = draft[it.id];
                      const recv = parseInt(d?.qty ?? "0", 10) || 0;
                      const diverge = recv !== it.remaining;
                      const done = it.remaining === 0;
                      return (
                        <div
                          key={it.id}
                          className={`rounded-xl border p-3 ${
                            done
                              ? "border-slate-100 bg-slate-50/50 dark:border-ink-800 dark:bg-ink-950/40"
                              : "border-slate-200 dark:border-ink-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-700 dark:text-slate-200">
                                {it.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                Pedido: {it.ordered} · Já recebido: {it.received} ·
                                Falta: {it.remaining} · {brl(it.unitCost)}/un
                              </p>
                            </div>
                          </div>
                          {done ? (
                            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Item já recebido
                            </p>
                          ) : (
                            <div className="mt-2.5 flex flex-wrap items-center gap-3">
                              <label className="text-xs text-slate-500">
                                Recebido agora
                                <input
                                  value={d?.qty ?? ""}
                                  onChange={(e) => setLine(it.id, { qty: e.target.value })}
                                  inputMode="numeric"
                                  className="mt-1 block w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                                />
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={d?.qualityOk !== false}
                                  onChange={(e) =>
                                    setLine(it.id, { qualityOk: e.target.checked })
                                  }
                                  className="h-4 w-4 accent-emerald-500"
                                />
                                Qualidade OK
                              </label>
                              {diverge && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Divergência ({recv > it.remaining ? "+" : ""}
                                  {recv - it.remaining})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Observação do recebimento
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                     aria-label="Observação do recebimento" />
                  </div>

                  {receipts.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Recebimentos anteriores
                      </h3>
                      <div className="space-y-1.5">
                        {receipts.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-ink-800"
                          >
                            <span className="font-mono text-slate-600 dark:text-slate-300">
                              {r.number}
                            </span>
                            <span className="text-slate-400">
                              {r.items.reduce((a, i) => a + i.qtyReceived, 0)} un ·{" "}
                              {r.createdAt}
                            </span>
                          </div>
                        ))}
                      </div>
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
                    onClick={confirm}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PackageCheck className="h-4 w-4" />
                    )}
                    Confirmar recebimento
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
