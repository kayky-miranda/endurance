"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import type { LabExamRow, LabExamsView } from "@/lib/endurance/lab-exams";
import { EXAM_FLAG_LABEL, type ExamFlag } from "@/lib/endurance/lab-exam-rules";
import { createExamAction, deleteExamAction } from "../exames-actions";

/**
 * Exames laboratoriais dentro do prontuário. A sinalização de alterado sai da
 * FAIXA DE REFERÊNCIA do laudo (comparação determinística), não de IA — por isso
 * pode ser exibida como fato.
 */

const FLAG_STYLE: Record<ExamFlag, string> = {
  normal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  alto: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  baixo: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  sem_referencia: "bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400",
};

const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const num = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export default function ExamsPanel({
  slug: _slug,
  customerId,
  data,
}: {
  slug: string;
  customerId: string;
  data: LabExamsView;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function remove(e: LabExamRow) {
    if (!confirm(`Remover o resultado de ${e.name} (${dt(e.collectedAt)})?`)) return;
    setError("");
    setPendingId(e.id);
    startTransition(async () => {
      const res = await deleteExamAction({ id: e.id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FlaskConical className="h-4 w-4 text-brand-500" /> Exames laboratoriais
          {data.alteredCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
              {data.alteredCount} fora da referência
            </span>
          )}
          {data.severeCount > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
              {data.severeCount} com desvio grande
            </span>
          )}
        </h2>
        <button
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" /> Registrar resultado
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {data.exams.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Nenhum resultado registrado. Informe a faixa de referência do laudo para
          o sistema sinalizar valores fora do esperado.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-ink-800">
                <th className="py-2 pr-3 font-medium">Exame</th>
                <th className="py-2 pr-3 text-right font-medium">Resultado</th>
                <th className="py-2 pr-3 font-medium">Referência</th>
                <th className="py-2 pr-3 font-medium">Situação</th>
                <th className="py-2 pr-3 font-medium">vs. anterior</th>
                <th className="py-2 pr-3 font-medium">Coleta</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
              {data.exams.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-ink-800/40">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{e.name}</p>
                    {e.panel && <p className="text-[11px] text-slate-400">{e.panel}</p>}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {num(e.value)}
                    {e.unit && <span className="ml-1 text-xs font-normal text-slate-400">{e.unit}</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                    {e.rangeLabel}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${FLAG_STYLE[e.flag]}`}
                    >
                      {e.flag === "alto" && <ArrowUp className="h-3 w-3" />}
                      {e.flag === "baixo" && <ArrowDown className="h-3 w-3" />}
                      {EXAM_FLAG_LABEL[e.flag]}
                      {e.severe && " ·"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                    {e.trend === "primeiro" ? (
                      <span className="text-slate-300">primeiro</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {e.trend === "subiu" && <ArrowUp className="h-3 w-3" />}
                        {e.trend === "desceu" && <ArrowDown className="h-3 w-3" />}
                        {e.trend === "estavel" && <Minus className="h-3 w-3" />}
                        {e.delta > 0 ? "+" : ""}
                        {e.delta !== 0 ? num(e.delta) : "sem mudança"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                    {dt(e.collectedAt)}
                  </td>
                  <td className="py-2 text-right">
                    {pendingId === e.id ? (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-400" />
                    ) : (
                      <button
                        onClick={() => remove(e)}
                        aria-label={`Remover resultado de ${e.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <ExamModal
          customerId={customerId}
          busy={busy}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function ExamModal({
  customerId,
  busy: _busy,
  onClose,
  onSaved,
}: {
  customerId: string;
  busy: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [f, setF] = useState({
    name: "",
    panel: "",
    value: "",
    unit: "",
    refMin: "",
    refMax: "",
    collectedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Aceita vírgula decimal (padrão BR) sem obrigar o usuário a trocar.
  const toNum = (s: string): number | null => {
    const t = s.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  function submit() {
    setError("");
    const value = toNum(f.value);
    if (value === null) {
      setError("Informe o valor do resultado.");
      return;
    }
    startTransition(async () => {
      const res = await createExamAction({
        customerId,
        name: f.name,
        panel: f.panel,
        value,
        unit: f.unit,
        refMin: toNum(f.refMin),
        refMax: toNum(f.refMax),
        collectedAt: f.collectedAt,
        notes: f.notes,
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="exam-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
            Registrar resultado de exame
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <label className="block text-xs font-medium text-slate-500">
            Exame*
            <input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Hemoglobina glicada"
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Painel / grupo
              <input
                value={f.panel}
                onChange={(e) => set("panel", e.target.value)}
                placeholder="Hemograma…"
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Data da coleta*
              <input
                type="date"
                value={f.collectedAt}
                onChange={(e) => set("collectedAt", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-xs font-medium text-slate-500">
              Resultado*
              <input
                inputMode="decimal"
                value={f.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Unidade
              <input
                value={f.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="mg/dL"
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Ref. mín.
              <input
                inputMode="decimal"
                value={f.refMin}
                onChange={(e) => set("refMin", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Ref. máx.
              <input
                inputMode="decimal"
                value={f.refMax}
                onChange={(e) => set("refMax", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            A faixa de referência vem do laudo e é o que permite sinalizar valores
            fora do esperado. Sem ela, o resultado é guardado mas não classificado.
          </p>
          <label className="block text-xs font-medium text-slate-500">
            Observações
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
