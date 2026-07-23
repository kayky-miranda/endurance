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
