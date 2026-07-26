"use client";

import { useState, useTransition } from "react";
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
  CalendarDays,
  Ban,
} from "lucide-react";
import {
  STATUS_LABEL,
  canTransition,
  toDateInput,
  addDays,
  weekDays,
  monthGridDays,
  minutesSinceMidnight,
  isSameDay,
  startOfWeek,
  WEEKDAY_LABELS,
  type AppointmentStatus,
} from "@/lib/endurance/scheduling";
import type { AppointmentRow, ProfessionalOption } from "@/lib/endurance/agenda";
import type { BlockRow } from "@/lib/endurance/schedule-blocks";
import {
  setAppointmentStatusAction,
  deleteAppointmentAction,
  deleteBlockAction,
} from "./agenda-actions";
import AppointmentModal from "./appointment-modal";
import BlockModal from "./block-modal";

export type AgendaViewMode = "dia" | "semana" | "mes";

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  agendado: "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300",
  confirmado: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  atendido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  faltou: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  cancelado: "bg-rose-500/15 text-rose-600 dark:text-rose-300 line-through",
};
const BLOCK_STYLE: Record<AppointmentStatus, string> = {
  agendado: "bg-slate-100 border-slate-300 text-slate-700 dark:bg-ink-800 dark:border-ink-600 dark:text-slate-200",
  confirmado: "bg-brand-500/15 border-brand-400 text-brand-700 dark:text-brand-200",
  atendido: "bg-emerald-500/15 border-emerald-400 text-emerald-700 dark:text-emerald-200",
  faltou: "bg-amber-500/15 border-amber-400 text-amber-700 dark:text-amber-200",
  cancelado: "bg-rose-500/10 border-rose-300 text-rose-600 line-through dark:text-rose-300",
};

const QUICK: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  agendado: ["confirmado", "atendido", "faltou", "cancelado"],
  confirmado: ["atendido", "faltou", "cancelado"],
  faltou: ["agendado"],
};

// Janela de horários do grid (07:00–21:00).
const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 21 * 60;
const HOUR_PX = 56;
const gridHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * HOUR_PX;

type ModalState =
  | { mode: "new"; initialDate?: string; initialTime?: string }
  | { mode: "edit"; appointment: AppointmentRow }
  | null;

export default function AgendaView({
  slug,
  view,
  date,
  professionalId,
  appointments,
  blocks,
  professionals,
}: {
  slug: string;
  view: AgendaViewMode;
  date: string; // YYYY-MM-DD (âncora da visão)
  professionalId: string;
  appointments: AppointmentRow[];
  blocks: BlockRow[];
  professionals: ProfessionalOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const anchor = parseDate(date);

  function go(params: { view?: AgendaViewMode; data?: string; prof?: string }) {
    const v = params.view ?? view;
    const dt = params.data ?? date;
    const prof = params.prof ?? professionalId;
    const qs = new URLSearchParams();
    qs.set("view", v);
    qs.set("data", dt);
    if (prof) qs.set("prof", prof);
    router.push(`/espaco/${slug}/m/agenda_consultas?${qs.toString()}`);
  }

  function shift(dir: number) {
    if (view === "dia") go({ data: toDateInput(addDays(anchor, dir)) });
    else if (view === "semana") go({ data: toDateInput(addDays(anchor, dir * 7)) });
    else go({ data: toDateInput(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)) });
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

  function removeBlock(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteBlockAction(id);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const label = rangeLabel(view, anchor);

  return (
    <div className="space-y-4">
      {/* Barra de controle */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="Anterior" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => shift(1)} aria-label="Próximo" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => go({ data: toDateInput(new Date()) })} className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600">
            Hoje
          </button>
        </div>

        <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
          {label}
        </span>

        {/* Seletor de visão */}
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-ink-600">
          {(["dia", "semana", "mes"] as AgendaViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => go({ view: v })}
              className={`px-3 py-2 text-xs font-semibold capitalize transition ${
                view === v
                  ? "bg-brand-500 text-ink-950"
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-ink-800"
              }`}
            >
              {v === "mes" ? "mês" : v}
            </button>
          ))}
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
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setBlockOpen(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-rose-400 hover:text-rose-500 dark:border-ink-600 dark:text-slate-300"
        >
          <Ban className="h-4 w-4" /> Bloquear
        </button>
        <button
          onClick={() => setModal({ mode: "new", initialDate: date })}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo atendimento
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {view === "dia" && (
        <DayList
          date={date}
          appointments={appointments}
          blocks={blocks}
          busy={busy}
          pendingId={pendingId}
          onEdit={(a) => setModal({ mode: "edit", appointment: a })}
          onQuickStatus={quickStatus}
          onRemove={remove}
          onRemoveBlock={removeBlock}
        />
      )}
      {view === "semana" && (
        <WeekGrid
          anchor={anchor}
          appointments={appointments}
          blocks={blocks}
          onEdit={(a) => setModal({ mode: "edit", appointment: a })}
          onSlot={(d, t) => setModal({ mode: "new", initialDate: d, initialTime: t })}
          onPickDay={(d) => go({ view: "dia", data: d })}
        />
      )}
      {view === "mes" && (
        <MonthGrid
          anchor={anchor}
          appointments={appointments}
          onEdit={(a) => setModal({ mode: "edit", appointment: a })}
          onPickDay={(d) => go({ view: "dia", data: d })}
        />
      )}

      {modal && (
        <AppointmentModal
          date={date}
          professionals={professionals}
          appointment={modal.mode === "edit" ? modal.appointment : null}
          initialDate={modal.mode === "new" ? modal.initialDate : undefined}
          initialTime={modal.mode === "new" ? modal.initialTime : undefined}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {blockOpen && (
        <BlockModal
          professionals={professionals}
          initialDate={date}
          onClose={() => setBlockOpen(false)}
          onSaved={() => {
            setBlockOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Clampa um bloqueio ao dia D dentro da janela do grid; null se fora. */
function blockBandForDay(
  block: BlockRow,
  day: Date,
): { top: number; height: number } | null {
  const dayMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const nextMidnight = dayMidnight + 86_400_000;
  const s = Math.max(new Date(block.startsAt).getTime(), dayMidnight);
  const e = Math.min(new Date(block.endsAt).getTime(), nextMidnight);
  if (e <= s) return null;
  let startMin = (s - dayMidnight) / 60_000;
  let endMin = (e - dayMidnight) / 60_000;
  startMin = Math.min(Math.max(startMin, DAY_START_MIN), DAY_END_MIN);
  endMin = Math.min(Math.max(endMin, DAY_START_MIN), DAY_END_MIN);
  if (endMin <= startMin) return null;
  return {
    top: ((startMin - DAY_START_MIN) / 60) * HOUR_PX,
    height: ((endMin - startMin) / 60) * HOUR_PX,
  };
}

// ---------- Visão DIA (lista rica com ações rápidas) ----------
function DayList({
  date,
  appointments,
  blocks,
  busy,
  pendingId,
  onEdit,
  onQuickStatus,
  onRemove,
  onRemoveBlock,
}: {
  date: string;
  appointments: AppointmentRow[];
  blocks: BlockRow[];
  busy: boolean;
  pendingId: string | null;
  onEdit: (a: AppointmentRow) => void;
  onQuickStatus: (id: string, s: AppointmentStatus) => void;
  onRemove: (id: string) => void;
  onRemoveBlock: (id: string) => void;
}) {
  const day = parseDate(date);
  const dayBlocks = blocks.filter(
    (b) =>
      new Date(b.startsAt).getTime() <
        new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() &&
      new Date(b.endsAt).getTime() >
        new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime(),
  );

  const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const blocksStrip = dayBlocks.length > 0 && (
    <ul className="space-y-1.5">
      {dayBlocks.map((b) => (
        <li
          key={b.id}
          className="flex items-center gap-2 rounded-xl border border-dashed border-rose-300 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:text-rose-300"
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">{b.kindLabel}</span>
          <span className="text-rose-500/80">
            {hhmm(b.startsAt)}–{hhmm(b.endsAt)}
            {b.professional ? ` · ${b.professional}` : " · toda a agenda"}
            {b.reason ? ` · ${b.reason}` : ""}
          </span>
          {pendingId === b.id ? (
            <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
          ) : (
            <button
              onClick={() => onRemoveBlock(b.id)}
              disabled={busy}
              aria-label="Remover bloqueio"
              className="ml-auto grid h-6 w-6 place-items-center rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (appointments.length === 0) {
    return (
      <div className="space-y-3">
        {blocksStrip}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Clock className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Nenhum atendimento neste dia. Clique em <strong>Novo atendimento</strong>.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {blocksStrip}
      <ul className="space-y-2">
      {appointments.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-ink-700 dark:bg-ink-900">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-2 dark:bg-ink-950">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{a.startTime}</span>
            <span className="text-[11px] text-slate-400">{a.endTime}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{a.customerName || "Sem nome"}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status]}`}>
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
              {a.price > 0 && <span>R$ {a.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
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
                      onClick={() => onQuickStatus(a.id, to)}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
                    >
                      {STATUS_LABEL[to]}
                    </button>
                  ))}
                <button onClick={() => onEdit(a)} aria-label="Editar atendimento" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onRemove(a.id)} aria-label="Excluir atendimento" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </li>
      ))}
      </ul>
    </div>
  );
}

// ---------- Visão SEMANA (grade de horários) ----------
function WeekGrid({
  anchor,
  appointments,
  blocks,
  onEdit,
  onSlot,
  onPickDay,
}: {
  anchor: Date;
  appointments: AppointmentRow[];
  blocks: BlockRow[];
  onEdit: (a: AppointmentRow) => void;
  onSlot: (date: string, time: string) => void;
  onPickDay: (date: string) => void;
}) {
  const days = weekDays(anchor);
  const hours = hourMarks();
  const today = new Date();

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="min-w-[720px]">
        {/* Cabeçalho dos dias */}
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-slate-100 dark:border-ink-800">
          <div />
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onPickDay(toDateInput(d))}
                className="border-l border-slate-100 py-2 text-center hover:bg-slate-50 dark:border-ink-800 dark:hover:bg-ink-800"
              >
                <span className="block text-[11px] uppercase text-slate-400">{WEEKDAY_LABELS[d.getDay()]}</span>
                <span className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${isToday ? "bg-brand-500 text-ink-950" : "text-slate-700 dark:text-slate-200"}`}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        {/* Corpo com grade */}
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
          {/* Eixo de horas */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-400" style={{ top: ((h * 60 - DAY_START_MIN) / 60) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d.toISOString()} day={d} appointments={appointments} blocks={blocks} onEdit={onEdit} onSlot={onSlot} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  appointments,
  blocks,
  onEdit,
  onSlot,
}: {
  day: Date;
  appointments: AppointmentRow[];
  blocks: BlockRow[];
  onEdit: (a: AppointmentRow) => void;
  onSlot: (date: string, time: string) => void;
}) {
  const dayAppts = appointments.filter((a) => isSameDay(new Date(a.startsAt), day));
  const dayBlocks = blocks
    .map((b) => ({ b, band: blockBandForDay(b, day) }))
    .filter((x): x is { b: BlockRow; band: { top: number; height: number } } => x.band !== null);

  function onColumnClick(e: React.MouseEvent<HTMLDivElement>) {
    // Só cria se clicou no fundo (não num bloco/atendimento).
    if ((e.target as HTMLElement).closest("[data-appt]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let minutes = DAY_START_MIN + (y / HOUR_PX) * 60;
    minutes = Math.max(DAY_START_MIN, Math.round(minutes / 15) * 15);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    onSlot(toDateInput(day), `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="relative border-l border-slate-100 dark:border-ink-800" style={{ height: gridHeight }} onClick={onColumnClick}>
      {/* Linhas de hora */}
      {hourMarks().map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-slate-50 dark:border-ink-800/60" style={{ top: ((h * 60 - DAY_START_MIN) / 60) * HOUR_PX }} />
      ))}
      {/* Bloqueios (faixas hachuradas, atrás dos atendimentos) */}
      {dayBlocks.map(({ b, band }) => (
        <div
          key={b.id}
          className="pointer-events-none absolute inset-x-0 overflow-hidden bg-[repeating-linear-gradient(45deg,rgba(244,63,94,0.10),rgba(244,63,94,0.10)_6px,transparent_6px,transparent_12px)] px-1 py-0.5 text-[10px] font-medium text-rose-500/80"
          style={{ top: band.top, height: band.height }}
          title={`${b.kindLabel}${b.reason ? " — " + b.reason : ""}`}
        >
          {b.kindLabel}
        </div>
      ))}
      {dayAppts.map((a) => {
        const start = minutesSinceMidnight(new Date(a.startsAt));
        const top = ((start - DAY_START_MIN) / 60) * HOUR_PX;
        const height = Math.max(18, (a.durationMin / 60) * HOUR_PX - 2);
        return (
          <button
            key={a.id}
            data-appt
            onClick={(e) => {
              e.stopPropagation();
              onEdit(a);
            }}
            className={`absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight ${BLOCK_STYLE[a.status]}`}
            style={{ top: Math.max(0, top), height }}
            title={`${a.startTime} ${a.customerName} — ${STATUS_LABEL[a.status]}`}
          >
            <span className="block font-semibold">{a.startTime}</span>
            <span className="block truncate">{a.customerName || "Sem nome"}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Visão MÊS ----------
function MonthGrid({
  anchor,
  appointments,
  onEdit,
  onPickDay,
}: {
  anchor: Date;
  appointments: AppointmentRow[];
  onEdit: (a: AppointmentRow) => void;
  onPickDay: (date: string) => void;
}) {
  const grid = monthGridDays(anchor);
  const month = anchor.getMonth();
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-medium uppercase text-slate-400 dark:border-ink-800">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const inMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const dayAppts = appointments
            .filter((a) => isSameDay(new Date(a.startsAt), d))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div key={d.toISOString()} className={`min-h-[92px] border-b border-l border-slate-100 p-1 dark:border-ink-800 ${inMonth ? "" : "bg-slate-50/50 dark:bg-ink-950/40"}`}>
              <button
                onClick={() => onPickDay(toDateInput(d))}
                className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? "bg-brand-500 text-ink-950" : inMonth ? "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800" : "text-slate-300 dark:text-slate-600"}`}
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onEdit(a)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${BLOCK_STYLE[a.status]}`}
                    title={`${a.startTime} ${a.customerName}`}
                  >
                    {a.startTime} {a.customerName || "Sem nome"}
                  </button>
                ))}
                {dayAppts.length > 3 && (
                  <button onClick={() => onPickDay(toDateInput(d))} className="flex w-full items-center gap-0.5 px-1 text-[10px] text-brand-500 hover:underline">
                    <CalendarDays className="h-2.5 w-2.5" /> +{dayAppts.length - 3}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- helpers ----------
function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

function hourMarks(): number[] {
  const out: number[] = [];
  for (let h = DAY_START_MIN / 60; h <= DAY_END_MIN / 60; h++) out.push(h);
  return out;
}

function rangeLabel(view: AgendaViewMode, anchor: Date): string {
  if (view === "dia") {
    return anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }
  if (view === "semana") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const fmt = (d: Date, withMonth: boolean) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", ...(withMonth ? { month: "short" } : {}) });
    return `${fmt(start, !sameMonth)} – ${fmt(end, true)} de ${end.getFullYear()}`;
  }
  return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
