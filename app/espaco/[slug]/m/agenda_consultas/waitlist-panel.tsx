"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ListPlus,
  Loader2,
  AlertCircle,
  Search,
  Trash2,
  CalendarPlus,
  X,
  Clock,
} from "lucide-react";
import type { ProfessionalOption } from "@/lib/endurance/agenda";
import type { WaitlistRow } from "@/lib/endurance/waitlist";
import { searchCustomersAction, type CustomerHit } from "./agenda-actions";
import {
  addWaitlistAction,
  removeWaitlistAction,
  markWaitlistScheduledAction,
} from "./waitlist-actions";
import AppointmentModal from "./appointment-modal";

export default function WaitlistPanel({
  date,
  entries,
  professionals,
}: {
  date: string;
  entries: WaitlistRow[];
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [scheduling, setScheduling] = useState<WaitlistRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function remove(id: string) {
    if (!confirm("Remover da lista de espera?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await removeWaitlistAction(id);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Clock className="h-4 w-4 text-brand-500" /> Lista de espera
          {entries.length > 0 && (
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-300">
              {entries.length}
            </span>
          )}
        </h2>
        {!adding && (
          <button
            onClick={() => {
              setError("");
              setAdding(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <ListPlus className="h-3.5 w-3.5" /> Adicionar
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {adding && (
        <WaitAddForm
          professionals={professionals}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      {entries.length === 0 && !adding ? (
        <p className="py-4 text-center text-sm text-slate-400">
          Ninguém na lista de espera.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-ink-800">
          {entries.map((w, i) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {w.customerName || "Sem nome"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[w.service, w.professional, w.notes].filter(Boolean).join(" · ") || "sem preferência"}
                </p>
              </div>
              {pendingId === w.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <button
                    onClick={() => {
                      setError("");
                      setScheduling(w);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Agendar
                  </button>
                  <button
                    onClick={() => remove(w.id)}
                    disabled={busy}
                    aria-label="Remover da espera"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {scheduling && (
        <AppointmentModal
          date={date}
          professionals={professionals}
          appointment={null}
          initialDate={date}
          prefill={{
            customerId: scheduling.customerId,
            customerName: scheduling.customerName,
            professionalId: scheduling.professionalId,
            service: scheduling.service,
          }}
          onClose={() => setScheduling(null)}
          onSaved={() => {
            const entryId = scheduling.id;
            setScheduling(null);
            // Ao criar a consulta, a entrada sai da lista de espera.
            startTransition(async () => {
              await markWaitlistScheduledAction(entryId);
              router.refresh();
            });
          }}
        />
      )}
    </section>
  );
}

function WaitAddForm({
  professionals,
  onClose,
  onSaved,
}: {
  professionals: ProfessionalOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onNameChange(v: string) {
    setCustomerName(v);
    setCustomerId(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      setShowHits(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await searchCustomersAction(v);
      setHits(res);
      setShowHits(res.length > 0);
    }, 250);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await addWaitlistAction({
        customerId,
        customerName,
        professionalId: professionalId || null,
        service,
        notes,
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={customerName}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => hits.length > 0 && setShowHits(true)}
          placeholder="Paciente (nome ou telefone)…"
          aria-label="Paciente"
          autoComplete="off"
          className={`${inputCls} pl-9`}
        />
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
      <div className="grid grid-cols-2 gap-2">
        <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} aria-label="Profissional" className={inputCls}>
          <option value="">Qualquer profissional</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Serviço" aria-label="Serviço" className={inputCls} />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferência de horário / observações" aria-label="Observações" className={inputCls} />

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <X className="h-3.5 w-3.5" /> cancelar
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Adicionar à espera
        </button>
      </div>
    </div>
  );
}
