import { NextResponse } from "next/server";
import { getSession, canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/db";

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

// Escapa um campo para CSV (aspas + ponto-e-vírgula como separador, padrão BR).
const cell = (v: string | number) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!canManageTeam(session.role))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const entries = await prisma.financialEntry.findMany({
    where: { organizationId: session.org },
    orderBy: [{ kind: "asc" }, { dueDate: "asc" }],
  });

  const header = [
    "Tipo",
    "Descrição",
    "Categoria",
    "Valor",
    "Vencimento",
    "Status",
    "Pago em",
    "Forma",
  ];
  const lines = entries.map((e) =>
    [
      e.kind === "receber" ? "A receber" : "A pagar",
      e.description,
      e.category,
      e.amount.toFixed(2).replace(".", ","),
      fmtDate(e.dueDate),
      e.status === "pago" ? "Pago" : "Pendente",
      fmtDate(e.paidAt),
      e.method,
    ]
      .map(cell)
      .join(";"),
  );
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${slug}-${today}.csv"`,
    },
  });
}
