import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { money } from "@/lib/endurance/money";
import { csvResponse, csvMoney } from "@/lib/endurance/csv";

const MAX_ROWS = 50_000;

// Exporta os lançamentos financeiros (contas a pagar/receber) em CSV.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "finance.reports"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const entries = await prisma.financialEntry.findMany({
    where: { organizationId: session.org },
    orderBy: { dueDate: "desc" },
    take: MAX_ROWS,
  });

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(
    `financeiro-${slug}-${today}.csv`,
    [
      "Tipo",
      "Descrição",
      "Categoria",
      "Valor",
      "Status",
      "Método",
      "Vencimento",
      "Pago em",
      "Conciliado em",
      "Ref. externa",
    ],
    entries.map((e) => [
      e.kind === "receber" ? "A receber" : "A pagar",
      e.description,
      e.category,
      csvMoney(money(e.amount)),
      e.status === "pago" ? "Pago" : "Pendente",
      e.method,
      e.dueDate.toISOString().slice(0, 10),
      e.paidAt ? e.paidAt.toISOString().slice(0, 10) : "",
      e.reconciledAt ? e.reconciledAt.toISOString().slice(0, 10) : "",
      e.externalRef,
    ]),
  );
}
