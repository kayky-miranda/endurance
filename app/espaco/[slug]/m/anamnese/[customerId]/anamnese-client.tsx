"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Save,
} from "lucide-react";
import type { AnamneseData } from "@/lib/endurance/anamnese";
import { saveAnamneseAction, deleteAnamneseAction } from "../anamnese-actions";

interface Row {
  key: string;
  question: string;
  answer: string;
}

let seq = 0;
const mkRow = (question = "", answer = ""): Row => ({
  key: `q${seq++}`,
  question,
  answer,
});

export default function AnamneseClient({
  slug,
  customerId,
  data,
}: {
  slug: string;
  customerId: string;
  data: AnamneseData;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [rows, setRows] = useState<Row[]>(
    data.items.length
      ? data.items.map((it) => mkRow(it.question, it.answer))
      : [mkRow()],
  );

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function addRow() {
    setRows((prev) => [...prev, mkRow()]);
  }

  function save(status: "rascunho" | "concluida") {
    setError("");
    setOk("");
    startTransition(async () => {
      const res = await saveAnamneseAction({
        customerId,
        status,
        items: rows.map((r) => ({ question: r.question, answer: r.answer })),
      });
      if (res.ok) {
        setOk(status === "concluida" ? "Anamnese concluída." : "Rascunho salvo.");
        router.refresh();
      } else setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Remover a anamnese deste paciente? O registro é preservado.")) return;
    setError("");
    startTransition(async () => {
      const res = await deleteAnamneseAction({ customerId });
      if (res.ok) router.push(`/espaco/${slug}/m/anamnese`);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Questionário
          </h2>
          {data.exists &&
            (data.status === "concluida" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> concluída
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                rascunho
              </span>
            ))}
          {!data.exists && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
              modelo do nicho
            </span>
          )}
        </div>
        {data.exists && (
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-500 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
      </div>

      {!data.exists && (
        <p className="rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          Este paciente ainda não tem anamnese. As perguntas abaixo vêm do modelo
          do seu nicho — edite, responda e salve.
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.key}
            className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="flex items-start gap-2">
              <input
                value={r.question}
                onChange={(e) => update(r.key, { question: e.target.value })}
                placeholder="Pergunta"
                aria-label="Pergunta"
                className="flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm font-medium text-slate-700 focus:border-slate-200 focus:bg-slate-50 dark:text-slate-200 dark:focus:border-ink-600 dark:focus:bg-ink-950"
              />
              <button
                onClick={() => removeRow(r.key)}
                disabled={rows.length === 1}
                aria-label="Remover pergunta"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              value={r.answer}
              onChange={(e) => update(r.key, { answer: e.target.value })}
              rows={2}
              placeholder="Resposta…"
              aria-label="Resposta"
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </li>
        ))}
      </ul>

      <button
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
      </button>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {ok}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => save("rascunho")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-200"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" /> Salvar rascunho
        </button>
        <button
          onClick={() => save("concluida")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <CheckCircle2 className="h-4 w-4" /> Concluir
        </button>
      </div>
    </div>
  );
}
