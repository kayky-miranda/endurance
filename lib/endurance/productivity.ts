import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

/**
 * Análise de produtividade por profissional (sem IA): a partir das consultas do
 * período, calcula atendimentos, faltas, taxa de comparecimento, faturamento e
 * ticket médio de cada profissional. Read-only; complementa comissões com uma
 * lente operacional.
 */

export interface ProductivityRow {
  professional: string;
  atendidos: number;
  faltas: number;
  cancelados: number;
  agendados: number; // total no período (todos os status, exceto cancelado)
  attendanceRate: number; // atendidos / (atendidos + faltas), 0..1
  revenue: number;
  avgTicket: number;
}

export interface ProductivityReport {
  rows: ProductivityRow[];
  totalAtendidos: number;
  totalRevenue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getProductivityReport(
  org: string,
  from: Date,
  to: Date,
): Promise<ProductivityReport> {
  const appts = await prisma.appointment.findMany({
    where: {
      organizationId: org,
      professionalId: { not: null },
      startsAt: { gte: from, lt: to },
    },
    select: { professional: true, status: true, price: true },
  });

  const agg = new Map<
    string,
    { atendidos: number; faltas: number; cancelados: number; agendados: number; revenue: number }
  >();
  for (const a of appts) {
    const key = a.professional || "Sem profissional";
    const cur =
      agg.get(key) ?? { atendidos: 0, faltas: 0, cancelados: 0, agendados: 0, revenue: 0 };
    if (a.status === "atendido") {
      cur.atendidos++;
      cur.revenue += money(a.price);
    } else if (a.status === "faltou") cur.faltas++;
    else if (a.status === "cancelado") cur.cancelados++;
    if (a.status !== "cancelado") cur.agendados++;
    agg.set(key, cur);
  }

  const rows: ProductivityRow[] = [...agg.entries()]
    .map(([professional, v]) => {
      const finalized = v.atendidos + v.faltas;
      return {
        professional,
        atendidos: v.atendidos,
        faltas: v.faltas,
        cancelados: v.cancelados,
        agendados: v.agendados,
        attendanceRate: finalized > 0 ? round2(v.atendidos / finalized) : 0,
        revenue: round2(v.revenue),
        avgTicket: v.atendidos > 0 ? round2(v.revenue / v.atendidos) : 0,
      };
    })
    .sort((a, b) => b.atendidos - a.atendidos || b.revenue - a.revenue);

  return {
    rows,
    totalAtendidos: rows.reduce((s, r) => s + r.atendidos, 0),
    totalRevenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
  };
}
