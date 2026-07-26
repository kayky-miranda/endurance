"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2, AlertCircle, Search, X } from "lucide-react";
import { useModalA11y } from "../../use-modal-a11y";
import { DURATION_OPTIONS } from "@/lib/endurance/scheduling";
import type { AppointmentRow, ProfessionalOption } from "@/lib/endurance/agenda";
import {
  saveAppointmentAction,
  searchCustomersAction,
  type CustomerHit,
} from "./agenda-actions";

/**
 * Modal de criar/editar atendimento — componente ÚNICO reutilizado por todas as
 * visões da agenda (dia/semana/mês). Ao criar a partir de um horário clicado no
 * calendário, `initialDate`/`initialTime` pré-preenchem o slot.
 */
export default function AppointmentModal({
  date,
  professionals,
  appointment,
  initialDate,
  initialTime,
  onClose,
  onSaved,
}: {
  /** Data de referência (fallback quando não é edição nem slot clicado). */
  date: string;
  professionals: ProfessionalOption[];
  appointment: AppointmentRow | null;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const initDate = appointment ? appointment.startsAt.slice(0, 10) : initialDate ?? date;
  const initTime = appointment ? appointment.startTime : initialTime ?? "09:00";

  const [customerId, setCustomerId] = useState<string | null>(appointment?.customerId ?? null);
  const [customerName, setCustomerName] = useState(appointment?.customerName ?? "");
  const [professionalIdSel, setProfessionalIdSel] = useState(appointment?.professionalId ?? "");
  const [service, setService] = useState(appointment?.service ?? "");
  const [dateVal, setDateVal] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [durationMin, setDurationMin] = useState(appointment?.durationMin ?? 30);
  const [price, setPrice] = useState(appointment?.price ? String(appointment.price) : "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onNameChange(v: string) {
    setCustomerName(v);
    setCustomerId(null);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (v.trim().length < 2) {
      setHits([]);
      setShowHits(false);
      return;
    }
    searchRef.current = setTimeout(async () => {
      const res = await searchCustomersAction(v);
      setHits(res);
      setShowHits(res.length > 0);
    }, 250);
  }

  useEffect(() => {
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, []);

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveAppointmentAction({
        id: appointment?.id,
        customerId,
        customerName,
        professionalId: professionalIdSel || null,
        service,
        date: dateVal,
        time,
        durationMin: Number(durationMin),
        price: Number(price.replace(",", ".")) || 0,
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
        aria-labelledby="agenda-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="agenda-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
            {appointment ? "Editar atendimento" : "Novo atendimento"}
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
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Cliente / paciente
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={customerName}
                  onChange={(e) => onNameChange(e.target.value)}
                  onFocus={() => hits.length > 0 && setShowHits(true)}
                  placeholder="Buscar por nome ou telefone…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                />
              </div>
            </label>
            {customerId && (
              <span className="mt-1 inline-block text-[11px] text-emerald-600 dark:text-emerald-400">
                ✓ cliente vinculado ao cadastro
              </span>
            )}
            {showHits && hits.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-ink-600 dark:bg-ink-900">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(h.id);
                        setCustomerName(h.name);
                        setShowHits(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-800"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{h.name}</span>
                      <span className="text-xs text-slate-400">{h.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Profissional
              <select value={professionalIdSel} onChange={(e) => setProfessionalIdSel(e.target.value)} className={inputCls}>
                <option value="">— (sem definir)</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Tipo de atendimento
              <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Consulta, sessão…" className={inputCls} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Data
              <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Hora
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Duração
              <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputCls}>
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-500">
            Valor (R$)
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className={inputCls} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Observações
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anotações internas do atendimento…" className={`${inputCls} resize-none`} />
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
            {appointment ? "Salvar" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
