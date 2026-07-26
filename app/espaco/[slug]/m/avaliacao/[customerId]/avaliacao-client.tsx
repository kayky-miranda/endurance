"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, Trash2, X, Activity } from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import {
  computeImc,
  imcClass,
  IMC_LABEL,
} from "@/lib/endurance/assessment";
import type { AssessmentRow } from "@/lib/endurance/avaliacao";
import { addAssessmentAction, deleteAssessmentAction } from "../avaliacao-actions";

type MetricKey =
  | "weightKg"
  | "heightCm"
  | "imc"
  | "bodyFatPct"
  | "muscleMassKg"
  | "waistCm"
  | "hipCm"
  | "chestCm"
  | "armCm"
  | "thighCm"
  | "restingHr";

const METRICS: { key: MetricKey; label: string; unit: string; higherIsBetter?: boolean }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "heightCm", label: "Altura", unit: "cm" },
  { key: "imc", label: "IMC", unit: "" },
  { key: "bodyFatPct", label: "% Gordura", unit: "%" },
  { key: "muscleMassKg", label: "Massa magra", unit: "kg", higherIsBetter: true },
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "hipCm", label: "Quadril", unit: "cm" },
  { key: "chestCm", label: "Peitoral", unit: "cm" },
  { key: "armCm", label: "Braço", unit: "cm", higherIsBetter: true },
  { key: "thighCm", label: "Coxa", unit: "cm", higherIsBetter: true },
  { key: "restingHr", label: "FC repouso", unit: "bpm" },
];

const fmt = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function AvaliacaoClient({
  customerId,
  assessments,
}: {
  customerId: string;
  assessments: AssessmentRow[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function remove(id: string) {
    if (!confirm("Remover esta avaliação?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteAssessmentAction({ id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const latest = assessments[0];
  const latestImc = latest ? latest.imc : null;
  const cls = imcClass(latestImc);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Avaliações
        </h2>
        <button
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova avaliação
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {assessments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma avaliação ainda. Clique em <strong>Nova avaliação</strong> para
            registrar as medidas do aluno.
          </p>
        </div>
      ) : (
        <>
          {cls && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  IMC {fmt(latestImc)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {IMC_LABEL[cls]} · última avaliação em {fmtDate(latest.assessedAt)}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-ink-800">
                  <th className="px-4 py-2.5 font-medium">Medida</th>
                  {assessments.map((a) => (
                    <th key={a.id} className="px-3 py-2.5 text-right font-medium">
                      {fmtDate(a.assessedAt)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                {METRICS.map((m) => (
                  <tr key={m.key}>
                    <td className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300">
                      {m.label}
                      {m.unit && <span className="ml-1 text-xs text-slate-400">({m.unit})</span>}
                    </td>
                    {assessments.map((a) => (
                      <td key={a.id} className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                        {fmt(a[m.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2 text-xs text-slate-400">Avaliador</td>
                  {assessments.map((a) => (
                    <td key={a.id} className="px-3 py-2 text-right text-xs text-slate-400">
                      {a.evaluator || "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2" />
                  {assessments.map((a) => (
                    <td key={a.id} className="px-3 py-2 text-right">
                      {pendingId === a.id ? (
                        <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />
                      ) : (
                        <button
                          onClick={() => remove(a.id)}
                          disabled={busy}
                          aria-label="Remover avaliação"
                          className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {assessments.some((a) => a.notes) && (
            <div className="space-y-1.5">
              {assessments
                .filter((a) => a.notes)
                .map((a) => (
                  <p key={a.id} className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{fmtDate(a.assessedAt)}:</span>{" "}
                    {a.notes}
                  </p>
                ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <AssessmentModal
          customerId={customerId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

const FIELDS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "heightCm", label: "Altura", unit: "cm" },
  { key: "bodyFatPct", label: "% Gordura", unit: "%" },
  { key: "muscleMassKg", label: "Massa magra", unit: "kg" },
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "hipCm", label: "Quadril", unit: "cm" },
  { key: "chestCm", label: "Peitoral", unit: "cm" },
  { key: "armCm", label: "Braço", unit: "cm" },
  { key: "thighCm", label: "Coxa", unit: "cm" },
  { key: "restingHr", label: "FC repouso", unit: "bpm" },
];

function AssessmentModal({
  customerId,
  onClose,
  onSaved,
}: {
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const parsedWeight = Number((vals.weightKg ?? "").replace(",", ".")) || null;
  const parsedHeight = Number((vals.heightCm ?? "").replace(",", ".")) || null;
  const previewImc = computeImc(parsedWeight, parsedHeight);

  function submit() {
    setError("");
    const measures: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = (vals[f.key] ?? "").replace(",", ".").trim();
      measures[f.key] = raw === "" ? null : Number(raw);
    }
    startTransition(async () => {
      const res = await addAssessmentAction({
        customerId,
        date,
        measures,
        notes,
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
        aria-labelledby="aval-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="aval-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
            Nova avaliação
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
            Data da avaliação
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs font-medium text-slate-500">
                {f.label} ({f.unit})
                <input
                  inputMode="decimal"
                  value={vals[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="—"
                  className={inputCls}
                />
              </label>
            ))}
          </div>

          {previewImc !== null && (
            <p className="rounded-lg bg-brand-500/5 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              IMC calculado: <strong>{previewImc.toLocaleString("pt-BR")}</strong>
            </p>
          )}

          <label className="block text-xs font-medium text-slate-500">
            Observações
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
