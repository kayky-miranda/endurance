import "server-only";
import { prisma } from "@/lib/db";

/**
 * Previsão de faltas (heurística, sem IA): cruza as consultas em aberto do dia
 * com o HISTÓRICO de faltas de cada paciente. Sinaliza quem tem taxa alta para
 * a recepção confirmar proativamente. Analítico e determinístico — não é
 * conselho clínico, é gestão de agenda.
 */

const MIN_FINALIZED = 3; // histórico mínimo para a taxa ser significativa
const RISK_THRESHOLD = 0.3; // >= 30% de faltas

export interface NoShowRisk {
  appointmentId: string;
  time: string; // HH:MM
  patient: string;
  professional: string;
  pastFaltas: number;
  pastFinalized: number;
  rate: number; // 0..1
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Consultas em aberto de hoje cujo paciente tem risco de falta acima do limite.
 * Ordenadas por taxa desc. Considera só o histórico ANTERIOR (exclui o dia).
 */
export async function getNoShowRisk(org: string): Promise<NoShowRisk[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const todays = await prisma.appointment.findMany({
    where: {
      organizationId: org,
      startsAt: { gte: todayStart, lt: todayEnd },
      status: { in: ["agendado", "confirmado"] },
      customerId: { not: null },
    },
    select: { id: true, startsAt: true, customerName: true, professional: true, customerId: true },
    orderBy: { startsAt: "asc" },
  });
  if (todays.length === 0) return [];

  const ids = Array.from(new Set(todays.map((a) => a.customerId as string)));

  // Histórico de finalizados (atendido/faltou) ANTES de hoje, por paciente+status.
  const hist = await prisma.appointment.groupBy({
    by: ["customerId", "status"],
    where: {
      organizationId: org,
      customerId: { in: ids },
      status: { in: ["atendido", "faltou"] },
      startsAt: { lt: todayStart },
    },
    _count: { _all: true },
  });

  const stats = new Map<string, { faltas: number; finalized: number }>();
  for (const h of hist) {
    if (!h.customerId) continue;
    const cur = stats.get(h.customerId) ?? { faltas: 0, finalized: 0 };
    cur.finalized += h._count._all;
    if (h.status === "faltou") cur.faltas += h._count._all;
    stats.set(h.customerId, cur);
  }

  const risks: NoShowRisk[] = [];
  for (const a of todays) {
    const s = stats.get(a.customerId as string);
    if (!s || s.finalized < MIN_FINALIZED) continue;
    const rate = s.faltas / s.finalized;
    if (rate < RISK_THRESHOLD) continue;
    risks.push({
      appointmentId: a.id,
      time: hhmm(a.startsAt),
      patient: a.customerName || "Sem nome",
      professional: a.professional,
      pastFaltas: s.faltas,
      pastFinalized: s.finalized,
      rate: Math.round(rate * 100) / 100,
    });
  }
  risks.sort((x, y) => y.rate - x.rate);
  return risks;
}
