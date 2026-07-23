"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { useModalA11y } from "../../use-modal-a11y";
import {
  STATUS_LABEL,
  DURATION_OPTIONS,
  canTransition,
  toDateInput,
  type AppointmentStatus,
} from "@/lib/endurance/scheduling";
import type { DayAgenda, AppointmentRow, ProfessionalOption } from "@/lib/endurance/agenda";
import {
  saveAppointmentAction,
  setAppointmentStatusAction,
  deleteAppointmentAction,
  searchCustomersAction,
  type CustomerHit,
} from "./agenda-actions";

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  agendado: "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300",
  confirmado: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  atendido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  faltou: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  cancelado: "bg-rose-500/15 text-rose-600 dark:text-rose-300 line-through",
};

// Ações rápidas de transição por estado atual (só as mais comuns viram botão).
const QUICK: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  agendado: ["confirmado", "atendido", "faltou", "cancelado"],
  confirmado: ["atendido", "faltou", "cancelado"],
  faltou: ["agendado"],
};

export default function AgendaClient({
  slug,
  date,
  professionalId,
  agenda,
  professionals,
}: {
  slug: string;
  date: string;
  professionalId: string;
  agenda: DayAgenda;
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function go(params: { dia?: string; prof?: string }) {
    const dia = params.dia ?? date;
    const prof = params.prof ?? professionalId;
    const qs = new URLSearchParams();
    qs.set("dia", dia);
    if (prof) qs.set("prof", prof);
    router.push(`/espaco/${slug}/m/agenda_consultas?${qs.toString()}`);
  }

  function shiftDay(days: number) {
    const [y, m, d] = date.split("-").map(Number);
    const nd = new Date(y, m - 1, d + days);
    go({ dia: toDateInput(nd) });
  }

  function quickStatus(id: string, status: AppointmentStatus) {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await setAppointmentStatusAction(id, status);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Excluir este atendimento? Esta ação não pode ser desfeita.")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteAppointmentAction(id);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const prettyDate = (() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  })();

  return (
    <div className="space-y-4">
      {/* Barra de controle: data, profissional, novo */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftDay(-1)}
            aria-label="Dia anterior"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            aria-label="Data da agenda"
            onChange={(e) => e.target.value && go({ dia: e.target.value })}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
          <button
            onClick={() => shiftDay(1)}
            aria-label="Próximo dia"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => go({ dia: toDateInput(new Date()) })}
            className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
          >
            Hoje
          </button>
        </div>

        {professionals.length > 0 && (
          <select
            value={professionalId}
            aria-label="Filtrar por profissional"
            onChange={(e) => go({ prof: e.target.value })}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          >
            <option value="">Todos os profissionais</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => {
            setError("");
            setCreating(true);
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo atendimento
        </button>
      </div>

      <p className="px-1 text-sm font-medium capitalize text-slate-500 dark:text-slate-400">
        {prettyDate}
      </p>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* Timeline do dia */}
      {agenda.appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Clock className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Nenhum atendimento neste dia. Clique em{" "}
            <strong>Novo atendimento</strong> para agendar.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {agenda.appointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-2 dark:bg-ink-950">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {a.startTime}
                </span>
                <span className="text-[11px] text-slate-400">{a.endTime}</span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{a.customerName || "Sem nome"}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status]}`}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                  {a.service && (
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" /> {a.service}
                    </span>
                  )}
                  {a.professional && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {a.professional}
                    </span>
                  )}
                  <span>{a.durationMin} min</span>
                  {a.price > 0 && (
                    <span>
                      R$ {a.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {pendingId === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    {(QUICK[a.status] ?? [])
                      .filter((to) => canTransition(a.status, to))
                      .map((to) => (
                        <button
                          key={to}
                          onClick={() => quickStatus(a.id, to)}
                          disabled={busy}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
                        >
                          {STATUS_LABEL[to]}
                        </button>
                      ))}
                    <button
                      onClick={() => {
                        setError("");
                        setEditing(a);
                      }}
                      aria-label="Editar atendimento"
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      aria-label="Excluir atendimento"
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <AppointmentModal
          date={date}
          professionals={professionals}
          appointment={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AppointmentModal({
  date,
  professionals,
  appointment,
  onClose,
  onSaved,
}: {
  date: string;
  professionals: ProfessionalOption[];
  appointment: AppointmentRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const initDate = appointment ? appointment.startsAt.slice(0, 10) : date;
  const initTime = appointment ? appointment.startTime : "09:00";

  const [customerId, setCustomerId] = useState<string | null>(appointment?.customerId ?? null);
  const [customerName, setCustomerName] = useState(appointment?.customerName ?? "");
  const [professionalIdSel, setProfessionalIdSel] = useState(appointment?.professionalId ?? "");
  const [service, setService] = useState(appointment?.service ?? "");
  const [dateVal, setDateVal] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [durationMin, setDurationMin] = useState(appointment?.durationMin ?? 30);
  const [price, setPrice] = useState(appointment?.price ? String(appointment.price) : "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  // Autocomplete de cliente
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onNameChange(v: string) {
    setCustomerName(v);
    setCustomerId(null); // digitar solta o vínculo até escolher de novo
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
          <h2
            id="agenda-modal-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
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
          {/* Cliente / paciente */}
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

          {/* Profissional + serviço */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Profissional
              <select
                value={professionalIdSel}
                onChange={(e) => setProfessionalIdSel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              >
                <option value="">— (sem definir)</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Tipo de atendimento
              <input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Consulta, sessão…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
          </div>

          {/* Data + hora + duração */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Data
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Hora
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Duração
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Preço + observações */}
          <label className="block text-xs font-medium text-slate-500">
            Valor (R$)
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Observações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anotações internas do atendimento…"
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
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
