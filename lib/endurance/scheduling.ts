/**
 * Lógica PURA da agenda de atendimentos (sem banco, sem "server-only") para
 * poder ser testada isoladamente e reutilizada no cliente e no servidor.
 *
 * Cobre a máquina de estados do atendimento, a detecção de conflito de horário
 * e os utilitários de faixa do dia. NÃO importa Prisma nem nada de servidor —
 * é o mesmo padrão de period.ts / sorting.ts.
 */

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "atendido"
  | "faltou"
  | "cancelado";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "agendado",
  "confirmado",
  "atendido",
  "faltou",
  "cancelado",
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

/**
 * Transições permitidas. Um atendimento nasce "agendado", pode ser confirmado,
 * e termina em um estado final (atendido/faltou/cancelado). Estados finais não
 * voltam atrás — reabrir é criar/remarcar, não editar o histórico.
 */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  agendado: ["confirmado", "atendido", "faltou", "cancelado"],
  confirmado: ["atendido", "faltou", "cancelado", "agendado"],
  atendido: [],
  faltou: ["agendado"], // remarcar quem faltou
  cancelado: [],
};

export function isValidStatus(s: string): s is AppointmentStatus {
  return (APPOINTMENT_STATUSES as string[]).includes(s);
}

/** Um estado final não ocupa mais a agenda (não gera conflito de horário). */
export function isBlockingStatus(s: AppointmentStatus): boolean {
  return s !== "cancelado";
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Dois atendimentos se sobrepõem se compartilham qualquer instante — comparação
 * meio-aberta [início, fim), então encostar (um termina quando o outro começa)
 * NÃO é conflito.
 */
export function overlaps(
  aStart: number,
  aDurationMin: number,
  bStart: number,
  bDurationMin: number,
): boolean {
  const aEnd = aStart + aDurationMin * 60_000;
  const bEnd = bStart + bDurationMin * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Sobreposição de dois intervalos [aStart, aEnd) e [bStart, bEnd) (ms).
 * Meio-aberto: encostar não conflita. Usado para bloqueio de agenda.
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Faixa [00:00, 24:00) de um dia local "YYYY-MM-DD". Inválido → hoje. */
export function dayRange(dateStr: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  const base = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/** "YYYY-MM-DD" no fuso local a partir de uma data (para inputs date). */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

// ---- Aritmética de calendário (semana/mês) — pura e testável ----

/** Data + n dias, preservando a hora local (sem drift de fuso). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Início da semana que contém `d` (domingo, padrão pt-BR de calendário), à
 * meia-noite local. `weekStartsOn` permite iniciar na segunda (1).
 */
export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 0): Date {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (base.getDay() - weekStartsOn + 7) % 7;
  return addDays(base, -diff);
}

/** Os 7 dias da semana que contém `d`. */
export function weekDays(d: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(d, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Grade do mês para renderização: sempre 6 semanas (42 dias) começando no
 * início da semana que contém o dia 1 — cobre o mês inteiro e completa as
 * bordas com dias dos meses vizinhos (como Google Calendar).
 */
export function monthGridDays(d: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const first = startOfMonth(d);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Minutos desde a meia-noite local (para posicionar no grid de horários). */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ---- Recorrência de agendamentos ----

export type RecurrenceFreq = "semanal" | "quinzenal" | "mensal";

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFreq; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

export function isValidRecurrenceFreq(s: string): s is RecurrenceFreq {
  return s === "semanal" || s === "quinzenal" || s === "mensal";
}

/** Limite de segurança de ocorrências geradas por série. */
export const MAX_RECURRENCE = 52;

/**
 * Datas de uma série recorrente a partir de `start` (inclusa), preservando a
 * hora local. `count` ocorrências no total (clampado a [1, MAX_RECURRENCE]).
 * Mensal soma meses de calendário (mantém o dia; meses curtos ajustam para o
 * último dia via new Date, comportamento padrão do JS tratado explicitamente).
 */
export function recurrenceDates(
  start: Date,
  freq: RecurrenceFreq,
  count: number,
): Date[] {
  const n = Math.min(MAX_RECURRENCE, Math.max(1, Math.floor(count)));
  const out: Date[] = [];
  const h = start.getHours();
  const min = start.getMinutes();
  for (let i = 0; i < n; i++) {
    if (freq === "semanal") out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 7, h, min));
    else if (freq === "quinzenal") out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 14, h, min));
    else {
      // Mensal: mantém o dia; se o mês não tiver o dia, cai no último dia dele.
      const target = new Date(start.getFullYear(), start.getMonth() + i, 1, h, min);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(start.getDate(), lastDay));
      out.push(target);
    }
  }
  return out;
}
