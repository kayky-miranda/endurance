"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, X, Ban } from "lucide-react";
import { useModalA11y } from "../../use-modal-a11y";
import { BLOCK_KINDS } from "@/lib/endurance/schedule-block";
import type { ProfessionalOption } from "@/lib/endurance/agenda";
import { createBlockAction } from "./agenda-actions";

/** Modal de criar bloqueio de agenda (bloqueio/almoço/férias/feriado). */
export default function BlockModal({
  professionals,
  initialDate,
  onClose,
  onSaved,
}: {
  professionals: ProfessionalOption[];
  initialDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [kind, setKind] = useState("bloqueio");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("12:00");
  const [endDate, setEndDate] = useState(initialDate);
  const [endTime, setEndTime] = useState("13:00");

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await createBlockAction({
        professionalId: professionalId || null,
        kind,
        reason,
        startDate,
        startTime,
        endDate,
        endTime,
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
        aria-labelledby="block-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="block-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Ban className="h-4 w-4 text-rose-500" /> Bloquear horário
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                {BLOCK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Profissional
              <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={inputCls}>
                <option value="">Toda a agenda</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Início
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Hora
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Fim
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Hora
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-500">
            Motivo (opcional)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Almoço, congresso, folga…" className={inputCls} />
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
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Bloquear
          </button>
        </div>
      </div>
    </div>
  );
}
