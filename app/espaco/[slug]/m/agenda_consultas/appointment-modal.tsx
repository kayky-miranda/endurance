"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2, AlertCircle, Search, X, Repeat, CheckCircle2, MessageCircle, CalendarPlus } from "lucide-react";
import { useModalA11y } from "../../use-modal-a11y";
import { DURATION_OPTIONS, RECURRENCE_FREQUENCIES } from "@/lib/endurance/scheduling";
import type { AppointmentRow, ProfessionalOption } from "@/lib/endurance/agenda";
import {
  saveAppointmentAction,
  createSeriesAction,
  searchCustomersAction,
  confirmByWhatsappAction,
  type CustomerHit,
} from "./agenda-actions";

/**
 * Modal de criar/editar atendimento — componente ÚNICO reutilizado por todas as
 * visões da agenda (dia/semana/mês). Ao criar a partir de um horário clicado no
 * calendário, `initialDate`/`initialTime` pré-preenchem o slot.
 */
export interface AppointmentPrefill {
  customerId?: string | null;
  customerName?: string;
  professionalId?: string | null;
  service?: string;
}

export default function AppointmentModal({
  slug,
  date,
  professionals,
  appointment,
  initialDate,
  initialTime,
  prefill,
  onClose,
  onSaved,
}: {
  slug: string;
  /** Data de referência (fallback quando não é edição nem slot clicado). */
  date: string;
  professionals: ProfessionalOption[];
  appointment: AppointmentRow | null;
  initialDate?: string;
  initialTime?: string;
  /** Pré-preenchimento ao criar (ex.: a partir da lista de espera). */
  prefill?: AppointmentPrefill;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [waBusy, startWa] = useTransition();
  const [error, setError] = useState("");

  function confirmWhatsapp() {
    if (!appointment) return;
    setError("");
    startWa(async () => {
      const res = await confirmByWhatsappAction(appointment.id);
      if (res.ok) window.open(res.url, "_blank");
      else setError(res.error);
    });
  }

  const initDate = appointment ? appointment.startsAt.slice(0, 10) : initialDate ?? date;
  const initTime = appointment ? appointment.startTime : initialTime ?? "09:00";

  const [customerId, setCustomerId] = useState<string | null>(appointment?.customerId ?? prefill?.customerId ?? null);
  const [customerName, setCustomerName] = useState(appointment?.customerName ?? prefill?.customerName ?? "");
  const [professionalIdSel, setProfessionalIdSel] = useState(appointment?.professionalId ?? prefill?.professionalId ?? "");
  const [service, setService] = useState(appointment?.service ?? prefill?.service ?? "");
  const [dateVal, setDateVal] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [durationMin, setDurationMin] = useState(appointment?.durationMin ?? 30);
  const [price, setPrice] = useState(appointment?.price ? String(appointment.price) : "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  // Recorrência (só na criação)
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState("semanal");
  const [count, setCount] = useState(4);
  const [summary, setSummary] = useState<{ created: number; skipped: { date: string; reason: string }[] } | null>(null);

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
    const base = {
      customerId,
      customerName,
      professionalId: professionalIdSel || null,
      service,
      date: dateVal,
      time,
      durationMin: Number(durationMin),
      price: Number(price.replace(",", ".")) || 0,
      notes,
    };
    startTransition(async () => {
      // Série recorrente (só ao criar): mostra resumo de criadas/puladas.
      if (!appointment && repeat) {
        const res = await createSeriesAction({ ...base, freq, count: Number(count) });
        if (res.ok) setSummary({ created: res.created, skipped: res.skipped });
        else setError(res.error);
        return;
      }
      const res = await saveAppointmentAction({ id: appointment?.id, ...base });
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

        {summary ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{summary.created} atendimento(s) criado(s) na série.</p>
            </div>
            {summary.skipped.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                <p className="mb-1 font-semibold">{summary.skipped.length} pulado(s) por conflito:</p>
                <ul className="space-y-0.5">
                  {summary.skipped.map((sk, i) => (
                    <li key={i}>• {sk.date} — {sk.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onSaved} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400">
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <>
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

          {/* Recorrência — só ao criar */}
          {!appointment && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-ink-700">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-500" />
                <Repeat className="h-3.5 w-3.5" /> Repetir este atendimento
              </label>
              {repeat && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-slate-500">
                    Frequência
                    <select value={freq} onChange={(e) => setFreq(e.target.value)} className={inputCls}>
                      {RECURRENCE_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-500">
                    Nº de ocorrências
                    <input type="number" min={1} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} />
                  </label>
                  <p className="col-span-2 text-[11px] text-slate-400">
                    Horários ocupados ou bloqueados na série são pulados automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {appointment && (
            <>
              <button
                onClick={confirmWhatsapp}
                disabled={waBusy}
                title="Enviar confirmação por WhatsApp"
                className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 py-2.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-400"
              >
                {waBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Confirmar por WhatsApp
              </button>
              <a
                href={`/espaco/${slug}/agenda-ics/${appointment.id}`}
                download
                title="Baixar evento (.ics) para Google Agenda, Outlook ou Apple"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
              >
                <CalendarPlus className="h-4 w-4" /> Calendário
              </a>
            </>
          )}
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
          </>
        )}
      </div>
    </div>
  );
}
