import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  isBlockingStatus,
  type AppointmentStatus,
} from "./scheduling";

/**
 * Painel da clínica (nichos de saúde): agrega a Agenda (Appointment) e o
 * financeiro das consultas num retrato operacional do dia + indicadores do
 * período. Toda a agregação roda no banco/no servidor; a UI só apresenta.
 *
 * Regra de faturamento da clínica: uma consulta gera receita quando é
 * `atendida` (o valor do atendimento). Faltas/cancelamentos não faturam.
 */

/** Nichos que usam o painel clínico em vez do painel de varejo. */
export const HEALTH_NICHES = new Set(["nutricionista", "psicologia", "clinica"]);
export function isHealthNiche(niche: string): boolean {
  return HEALTH_NICHES.has(niche);
}

/** Jornada padrão por profissional para o cálculo de ocupação (8h). */
const WORKDAY_MINUTES = 8 * 60;

export interface UpcomingAppointment {
  id: string;
  time: string; // HH:MM
  patient: string;
  professional: string;
  service: string;
  status: AppointmentStatus;
}

export interface ProfessionalRanking {
  professional: string;
  atendidos: number;
  faturamento: number;
}

export interface DashboardAlert {
  level: "info" | "warning" | "danger";
  message: string;
}

export interface DayPoint {
  date: string; // dd/mm
  agendados: number;
  atendidos: number;
}

export interface StatusSlice {
  status: AppointmentStatus;
  count: number;
}

export interface ClinicDashboard {
  today: {
    total: number;
    agendados: number;
    confirmados: number;
    atendidos: number;
    emAndamento: number;
    aguardando: number;
    faltas: number;
    cancelados: number;
  };
  upcoming: UpcomingAppointment[];
  faturamentoDia: number;
  faturamentoMes: number;
  taxaFaltas: number; // %
  taxaOcupacao: number; // %
  cancelamentosPeriodo: number;
  novosPacientesMes: number;
  novosPacientesHoje: number;
  periodDays: number;
  ranking: ProfessionalRanking[];
  porDia: DayPoint[];
  statusMix: StatusSlice[];
  alertas: DashboardAlert[];
}

const HHMM = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DDMM = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const round1 = (n: number) => Math.round(n * 10) / 10;

const asStatus = (s: string): AppointmentStatus =>
  (["agendado", "confirmado", "atendido", "faltou", "cancelado"].includes(s)
    ? s
    : "agendado") as AppointmentStatus;

export async function getClinicDashboard(
  org: string,
  opts: { periodDays?: number } = {},
): Promise<ClinicDashboard> {
  const periodDays = Math.min(180, Math.max(7, opts.periodDays ?? 30));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(todayEnd.getTime() - periodDays * 86_400_000);
  const chartStart = new Date(todayEnd.getTime() - 14 * 86_400_000);

  const [todays, period, faturamentoMesAgg, novosMes, novosHoje] =
    await Promise.all([
      prisma.appointment.findMany({
        where: { organizationId: org, startsAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { startsAt: "asc" },
      }),
      prisma.appointment.findMany({
        where: { organizationId: org, startsAt: { gte: periodStart, lt: todayEnd } },
        select: {
          status: true,
          price: true,
          professional: true,
          professionalId: true,
          startsAt: true,
        },
      }),
      prisma.appointment.aggregate({
        where: {
          organizationId: org,
          status: "atendido",
          startsAt: { gte: monthStart, lt: todayEnd },
        },
        _sum: { price: true },
      }),
      prisma.customer.count({
        where: { organizationId: org, createdAt: { gte: monthStart } },
      }),
      prisma.customer.count({
        where: { organizationId: org, createdAt: { gte: todayStart } },
      }),
    ]);

  // ---- Retrato do dia ----
  const today = {
    total: todays.length,
    agendados: 0,
    confirmados: 0,
    atendidos: 0,
    emAndamento: 0,
    aguardando: 0,
    faltas: 0,
    cancelados: 0,
  };
  let faturamentoDia = 0;
  let bookedMinutes = 0;
  const professionalsToday = new Set<string>();
  const nowMs = now.getTime();

  for (const a of todays) {
    const status = asStatus(a.status);
    const start = a.startsAt.getTime();
    const end = start + a.durationMin * 60_000;

    if (status === "agendado") today.agendados++;
    else if (status === "confirmado") today.confirmados++;
    else if (status === "atendido") {
      today.atendidos++;
      faturamentoDia += money(a.price);
    } else if (status === "faltou") today.faltas++;
    else if (status === "cancelado") today.cancelados++;

    if (isBlockingStatus(status)) {
      bookedMinutes += a.durationMin;
      if (a.professionalId) professionalsToday.add(a.professionalId);
    }
    // Em andamento: agora dentro do intervalo, ainda não finalizada.
    if ((status === "confirmado" || status === "agendado") && nowMs >= start && nowMs < end)
      today.emAndamento++;
    // Aguardando: confirmada, horário já começou, ainda não atendida.
    if (status === "confirmado" && nowMs >= start) today.aguardando++;
  }

  // ---- Próximas consultas de hoje ----
  const upcoming: UpcomingAppointment[] = todays
    .filter(
      (a) =>
        a.startsAt.getTime() >= nowMs &&
        (asStatus(a.status) === "agendado" || asStatus(a.status) === "confirmado"),
    )
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      time: HHMM(a.startsAt),
      patient: a.customerName || "Sem nome",
      professional: a.professional,
      service: a.service,
      status: asStatus(a.status),
    }));

  // ---- Indicadores do período ----
  let periodAtendidos = 0;
  let periodFaltas = 0;
  let cancelamentosPeriodo = 0;
  const statusCount: Record<AppointmentStatus, number> = {
    agendado: 0,
    confirmado: 0,
    atendido: 0,
    faltou: 0,
    cancelado: 0,
  };
  const rankMap = new Map<string, { atendidos: number; faturamento: number }>();
  const dayBuckets = new Map<string, { agendados: number; atendidos: number }>();

  // Sementes dos 14 dias do gráfico (para dias sem consulta aparecerem zerados).
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86_400_000);
    dayBuckets.set(DDMM(d), { agendados: 0, atendidos: 0 });
  }

  for (const a of period) {
    const status = asStatus(a.status);
    statusCount[status]++;
    if (status === "atendido") periodAtendidos++;
    if (status === "faltou") periodFaltas++;
    if (status === "cancelado") cancelamentosPeriodo++;

    if (status === "atendido") {
      const key = a.professional || "Sem profissional";
      const cur = rankMap.get(key) ?? { atendidos: 0, faturamento: 0 };
      cur.atendidos++;
      cur.faturamento += money(a.price);
      rankMap.set(key, cur);
    }

    if (a.startsAt >= chartStart) {
      const bucket = dayBuckets.get(DDMM(a.startsAt));
      if (bucket) {
        if (status !== "cancelado") bucket.agendados++;
        if (status === "atendido") bucket.atendidos++;
      }
    }
  }

  const finalizadas = periodAtendidos + periodFaltas;
  const taxaFaltas = finalizadas > 0 ? round1((periodFaltas / finalizadas) * 100) : 0;

  const capacity = Math.max(1, professionalsToday.size) * WORKDAY_MINUTES;
  const taxaOcupacao = Math.min(100, round1((bookedMinutes / capacity) * 100));

  const ranking: ProfessionalRanking[] = [...rankMap.entries()]
    .map(([professional, v]) => ({
      professional,
      atendidos: v.atendidos,
      faturamento: round1(v.faturamento),
    }))
    .sort((a, b) => b.atendidos - a.atendidos || b.faturamento - a.faturamento)
    .slice(0, 5);

  const porDia: DayPoint[] = [...dayBuckets.entries()].map(([date, v]) => ({
    date,
    agendados: v.agendados,
    atendidos: v.atendidos,
  }));

  const statusMix: StatusSlice[] = (Object.keys(statusCount) as AppointmentStatus[])
    .map((status) => ({ status, count: statusCount[status] }))
    .filter((s) => s.count > 0);

  // ---- Alertas derivados ----
  const alertas: DashboardAlert[] = [];
  const naoConfirmadas = today.agendados;
  if (naoConfirmadas > 0)
    alertas.push({
      level: "warning",
      message: `${naoConfirmadas} consulta(s) de hoje ainda não confirmada(s).`,
    });
  if (today.aguardando > 0)
    alertas.push({
      level: "info",
      message: `${today.aguardando} paciente(s) aguardando atendimento.`,
    });
  if (taxaFaltas >= 20)
    alertas.push({
      level: "danger",
      message: `Taxa de faltas alta no período: ${taxaFaltas}%.`,
    });
  if (today.total === 0)
    alertas.push({ level: "info", message: "Nenhuma consulta agendada para hoje." });

  return {
    today,
    upcoming,
    faturamentoDia: round1(faturamentoDia),
    faturamentoMes: round1(money(faturamentoMesAgg._sum.price ?? 0)),
    taxaFaltas,
    taxaOcupacao,
    cancelamentosPeriodo,
    novosPacientesMes: novosMes,
    novosPacientesHoje: novosHoje,
    periodDays,
    ranking,
    porDia,
    statusMix,
    alertas,
  };
}
