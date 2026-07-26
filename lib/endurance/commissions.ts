import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";

/**
 * Comissões de profissionais sobre a receita de CONSULTAS ATENDIDAS. Relatório
 * read-only (não movimenta o financeiro) + configuração do % por profissional.
 * Isolado por organização.
 */

export interface CommissionRow {
  userId: string;
  name: string;
  commissionPercent: number;
  council: string;
  atendidos: number;
  revenue: number;
  commission: number;
}

export interface CommissionReport {
  from: string; // ISO date
  to: string; // ISO date
  rows: CommissionRow[];
  totalRevenue: number;
  totalCommission: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Relatório de comissões no período [from, to). Considera consultas com
 * status "atendido" e profissional definido; soma o preço como receita e
 * aplica o % do profissional. Inclui todos os profissionais ativos (mesmo com
 * 0 atendimentos) para dar visão completa.
 */
export async function getCommissionReport(
  org: string,
  from: Date,
  to: Date,
): Promise<CommissionReport> {
  const [users, profiles, appts] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: org, status: { not: "deleted" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.professionalProfile.findMany({
      where: { organizationId: org },
      select: { userId: true, commissionPercent: true, council: true },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: org,
        status: "atendido",
        professionalId: { not: null },
        startsAt: { gte: from, lt: to },
      },
      select: { professionalId: true, price: true },
    }),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const agg = new Map<string, { atendidos: number; revenue: number }>();
  for (const a of appts) {
    if (!a.professionalId) continue;
    const cur = agg.get(a.professionalId) ?? { atendidos: 0, revenue: 0 };
    cur.atendidos++;
    cur.revenue += money(a.price);
    agg.set(a.professionalId, cur);
  }

  const rows: CommissionRow[] = users.map((u) => {
    const prof = profileByUser.get(u.id);
    const percent = prof?.commissionPercent ?? 0;
    const a = agg.get(u.id) ?? { atendidos: 0, revenue: 0 };
    const revenue = round2(a.revenue);
    return {
      userId: u.id,
      name: u.name,
      commissionPercent: percent,
      council: prof?.council ?? "",
      atendidos: a.atendidos,
      revenue,
      commission: round2((revenue * percent) / 100),
    };
  });

  // Ordena por comissão desc, depois receita.
  rows.sort((x, y) => y.commission - x.commission || y.revenue - x.revenue);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totalRevenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    totalCommission: round2(rows.reduce((s, r) => s + r.commission, 0)),
  };
}

export type ProfileResult = { ok: true } | { ok: false; error: string };

/** Define o % de comissão (0–100) de um profissional (upsert). */
export async function setCommissionPercent(
  org: string,
  userId: string,
  percent: number,
): Promise<ProfileResult> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    return { ok: false, error: "Percentual inválido (0 a 100)." };
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: org },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "Profissional não encontrado." };

  await prisma.professionalProfile.upsert({
    where: { userId },
    update: { commissionPercent: percent },
    create: { organizationId: org, userId, commissionPercent: percent },
  });
  return { ok: true };
}
