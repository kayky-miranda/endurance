import { NextResponse } from "next/server";
import { requirePlanFeature } from "@/lib/endurance/plan-limits";
import { getSession, sessionHasPermission } from "@/lib/auth";
import { parsePeriod } from "@/lib/endurance/period";
import { getProductivityReport } from "@/lib/endurance/productivity";
import { getCommissionReport } from "@/lib/endurance/commissions";

/**
 * CSV dos Relatórios da clínica (produtividade + comissões por profissional).
 * Escopo por org + permissão finance.reports (mesma do módulo). Reagrega no
 * servidor pelo período (?dias=); separador ";" e BOM UTF-8 para o Excel BR.
 */

const num = (n: number) => n.toFixed(2).replace(".", ",");

const cell = (v: string | number) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!sessionHasPermission(session, "finance.reports"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  // Levar o dado para fora do sistema é capacidade de plano, não só de perfil.
  const plan = await requirePlanFeature(session.org, "data.export");
  if (!plan.ok) return new NextResponse(plan.error, { status: 402 });

  const days = parsePeriod(
    { dias: new URL(req.url).searchParams.get("dias") ?? undefined },
    30,
  );
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const [productivity, commissions] = await Promise.all([
    getProductivityReport(session.org, from, to),
    getCommissionReport(session.org, from, to),
  ]);

  // Junta comissão por nome do profissional (a produtividade não tem userId).
  const commByName = new Map(commissions.rows.map((r) => [r.name, r]));

  const header = [
    "Profissional",
    "Registro",
    "Atendimentos",
    "Faltas",
    "Comparecimento %",
    "Ticket médio",
    "Faturamento",
    "Comissão %",
    "Comissão",
  ];
  const lines = productivity.rows.map((r) => {
    const c = commByName.get(r.professional);
    return [
      r.professional,
      c?.council ?? "",
      r.atendidos,
      r.faltas,
      Math.round(r.attendanceRate * 100),
      num(r.avgTicket),
      num(r.revenue),
      c ? c.commissionPercent : "",
      c ? num(c.commission) : "",
    ]
      .map(cell)
      .join(";");
  });

  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-clinica-${slug}-${today}.csv"`,
    },
  });
}
