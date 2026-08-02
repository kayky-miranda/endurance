/**
 * Regras do briefing pré-consulta — PURAS (sem "server-only" e sem Prisma):
 * recebem os dados já lidos e decidem o que destacar. Ficam separadas do acesso
 * ao banco para serem testáveis linha a linha — são regras que aparecem na tela
 * como "pendência" do paciente, então precisam ser exatas.
 *
 * Tudo aqui é DETERMINÍSTICO: sai do que está registrado, sem IA e sem
 * inferência. É o que permite mostrar o briefing instantaneamente ao abrir o
 * paciente, enquanto a análise assistida (mais profunda) roda sob demanda.
 */

export type EventKind =
  | "consulta"
  | "falta"
  | "cancelamento"
  | "anotacao"
  | "prescricao"
  | "medicao"
  | "anexo"
  | "atestado"
  | "anamnese";

export interface TimelineEvent {
  kind: EventKind;
  /** ISO. */
  at: string;
  title: string;
  detail?: string;
  /** CID quando houver — o que dá densidade clínica à linha do tempo. */
  cid?: string;
}

export type PendingLevel = "alta" | "media" | "baixa";

export interface Pendency {
  level: PendingLevel;
  title: string;
  detail: string;
}

export const DAYS = 86_400_000;
export const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / DAYS);

export interface AppointmentLite {
  startsAt: Date;
  status: string;
  service: string;
}

export interface PendencyInput {
  now: Date;
  /** Consultas do paciente, MAIS RECENTES PRIMEIRO. */
  appointments: AppointmentLite[];
  hasAnamnese: boolean;
  anamneseComplete: boolean;
  lastMetricAt: Date | null;
  lastPrescriptionAt: Date | null;
}

/** Sem retorno agendado após este tempo desde o último atendimento. */
const RETURN_OVERDUE_DAYS = 120;
/** Acompanhamento por medições considerado parado. */
const METRICS_STALE_DAYS = 180;
/** Faltas seguidas que caracterizam risco de abandono. */
const CONSECUTIVE_MISSES = 2;

/**
 * Pendências do paciente. Cada regra responde a uma pergunta que o profissional
 * faria de qualquer forma ao abrir a ficha — só que sem precisar garimpar.
 */
export function computePendencies(input: PendencyInput): Pendency[] {
  const { now, appointments } = input;
  const out: Pendency[] = [];

  const finished = appointments.filter(
    (a) => a.status === "atendido" || a.status === "faltou",
  );
  const future = appointments.filter(
    (a) => a.startsAt > now && a.status !== "cancelado",
  );
  const lastAttended = appointments.find((a) => a.status === "atendido");

  // Abandono: faltas seguidas nas consultas já finalizadas.
  let misses = 0;
  for (const a of finished) {
    if (a.status === "faltou") misses++;
    else break;
  }
  if (misses >= CONSECUTIVE_MISSES) {
    out.push({
      level: "alta",
      title: `${misses} faltas consecutivas`,
      detail: "Risco de abandono do acompanhamento — vale um contato ativo.",
    });
  }

  // Retorno: muito tempo desde o último atendimento e nada agendado à frente.
  if (lastAttended && future.length === 0) {
    const d = daysBetween(now, lastAttended.startsAt);
    if (d >= RETURN_OVERDUE_DAYS) {
      out.push({
        level: d >= RETURN_OVERDUE_DAYS * 2 ? "alta" : "media",
        title: "Sem retorno agendado",
        detail: `Último atendimento há ${d} dias e nenhuma consulta futura marcada.`,
      });
    }
  }

  // Questionário inicial: base de quase toda a análise.
  if (!input.hasAnamnese) {
    out.push({
      level: "media",
      title: "Anamnese não preenchida",
      detail: "O questionário inicial ainda não foi registrado.",
    });
  } else if (!input.anamneseComplete) {
    out.push({
      level: "baixa",
      title: "Anamnese em rascunho",
      detail: "O questionário inicial não foi concluído.",
    });
  }

  // Acompanhamento por medições parado (peso, PA, escalas…).
  if (input.lastMetricAt) {
    const d = daysBetween(now, input.lastMetricAt);
    if (d >= METRICS_STALE_DAYS)
      out.push({
        level: "baixa",
        title: "Sem medições recentes",
        detail: `Última medição registrada há ${d} dias.`,
      });
  }

  // Prescrição antiga sem consulta depois dela: tratamento pode ter parado.
  if (input.lastPrescriptionAt && lastAttended) {
    if (
      lastAttended.startsAt <= input.lastPrescriptionAt &&
      daysBetween(now, input.lastPrescriptionAt) >= RETURN_OVERDUE_DAYS
    ) {
      out.push({
        level: "media",
        title: "Tratamento sem reavaliação",
        detail: `Última prescrição há ${daysBetween(now, input.lastPrescriptionAt)} dias, sem consulta posterior.`,
      });
    }
  }

  const order: Record<PendingLevel, number> = { alta: 0, media: 1, baixa: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Ordena a linha do tempo do mais recente para o mais antigo. */
export function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Há quanto tempo a pessoa é paciente da casa, em texto curto.
 * `null` quando não há nenhum marco registrado.
 */
export function tenureLabel(firstAt: Date | null, now: Date): string | null {
  if (!firstAt) return null;
  const d = daysBetween(now, firstAt);
  if (d < 0) return null;
  if (d < 30) return `${d} dia${d === 1 ? "" : "s"}`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0
    ? `${years} ano${years === 1 ? "" : "s"}`
    : `${years} ano${years === 1 ? "" : "s"} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}
