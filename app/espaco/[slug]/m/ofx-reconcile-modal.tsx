"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UploadCloud,
  Loader2,
  Landmark,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useModalA11y } from "../use-modal-a11y";
import { previewOfxAction, applyOfxAction } from "./finance-actions";
import type { OfxPreview } from "@/lib/endurance/ofx-reconcile";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Conciliação bancária por OFX: upload do extrato → prévia com o casamento
 * sugerido (valor + data próxima) linha a linha → o usuário confirma quais
 * baixar → efetivação. Nada é conciliado sem confirmação.
 */
export default function OfxReconcileModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<OfxPreview | null>(null);
  // fitid → entryId escolhido (só entram as linhas marcadas).
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  async function pickFile(f: File) {
    setError("");
    setBusy(true);
    const content = await f.text();
    const res = await previewOfxAction(content);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Pré-seleciona as sugestões (o usuário desmarca o que não quiser).
    const initial: Record<string, string> = {};
    for (const l of res.preview.lines)
      if (l.suggestion && !l.alreadyReconciled)
        initial[l.fitid] = l.suggestion.entryId;
    setPicked(initial);
    setPreview(res.preview);
  }

  const selectedCount = Object.keys(picked).length;

  async function apply() {
    if (busy || selectedCount === 0) return;
    setBusy(true);
    setError("");
    const pairs = Object.entries(picked).map(([fitid, entryId]) => ({ fitid, entryId }));
    const res = await applyOfxAction(pairs);
    setBusy(false);
    if (res.ok) {
      setDone(res.reconciled ?? 0);
      router.refresh();
    } else setError(res.error ?? "Falha ao conciliar.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ofx-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-ink-700 dark:bg-ink-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-ink-800">
          <h3
            id="ofx-title"
            className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
          >
            <Landmark className="h-5 w-5 text-brand-500" /> Conciliação bancária (OFX)
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {done !== null ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {done} lançamento(s) conciliado(s) e baixado(s) com sucesso.
            </div>
          ) : !preview ? (
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="grid w-full place-items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-brand-500 disabled:opacity-50 dark:border-ink-600"
              >
                {busy ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-brand-500" />
                )}
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Escolher extrato .OFX
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Exporte o extrato do seu banco no formato OFX (Money) e importe
                  aqui. O sistema sugere o casamento com as contas em aberto.
                </p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,text/plain,application/x-ofx"
                className="hidden"
                aria-label="Arquivo OFX"
                onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {preview.total} transação(ões) no extrato
                {preview.accountId ? ` · conta ${preview.accountId}` : ""} ·{" "}
                <strong>{preview.matched}</strong> com sugestão de baixa. Confira e
                confirme as que devem dar baixa no financeiro.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-700">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                      <th className="px-3 py-2 font-medium">Extrato</th>
                      <th className="px-3 py-2 font-medium">Casar com</th>
                      <th className="px-3 py-2 text-center font-medium">Baixar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr
                        key={l.fitid}
                        className="border-b border-slate-50 last:border-0 dark:border-ink-800/60"
                      >
                        <td className="px-3 py-2.5">
                          <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                            {l.kind === "receber" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                            )}
                            {brl(Math.abs(l.amount))}
                            <span className="text-xs font-normal text-slate-400">
                              {l.date}
                            </span>
                          </p>
                          <p className="truncate text-xs text-slate-400">{l.memo || "—"}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          {l.alreadyReconciled ? (
                            <span className="text-xs text-slate-400">já conciliado</span>
                          ) : l.candidates.length === 0 ? (
                            <span className="text-xs text-slate-400">sem correspondência</span>
                          ) : (
                            <select
                              value={picked[l.fitid] ?? ""}
                              aria-label="Lançamento correspondente"
                              onChange={(e) =>
                                setPicked((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value) next[l.fitid] = e.target.value;
                                  else delete next[l.fitid];
                                  return next;
                                })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-ink-600 dark:bg-ink-950 dark:text-slate-200"
                            >
                              <option value="">— não conciliar —</option>
                              {l.candidates.map((c) => (
                                <option key={c.entryId} value={c.entryId}>
                                  {c.description} · vence {c.dueDate}
                                  {c.daysApart > 0 ? ` (${c.daysApart}d)` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {!l.alreadyReconciled && l.candidates.length > 0 && (
                            <input
                              type="checkbox"
                              aria-label="Confirmar baixa deste lançamento"
                              checked={Boolean(picked[l.fitid])}
                              onChange={(e) =>
                                setPicked((prev) => {
                                  const next = { ...prev };
                                  if (e.target.checked)
                                    next[l.fitid] =
                                      picked[l.fitid] ?? l.candidates[0].entryId;
                                  else delete next[l.fitid];
                                  return next;
                                })
                              }
                              className="h-4 w-4 accent-brand-500"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        {preview && done === null && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4 dark:border-ink-800">
            <span className="text-xs text-slate-500">
              {selectedCount} selecionada(s) para baixa
            </span>
            <button
              onClick={apply}
              disabled={busy || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Conciliar {selectedCount} lançamento(s)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
