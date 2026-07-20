import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { money } from "@/lib/endurance/money";
import { csvResponse, csvMoney } from "@/lib/endurance/csv";

const MAX_DAYS = 366;
const MAX_ROWS = 50_000;

// Exporta as vendas do período (?dias=30|90|365) com itens agregados.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "reports.export"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const url = new URL(req.url);
  const dias = Math.min(
    MAX_DAYS,
    Math.max(1, parseInt(url.searchParams.get("dias") ?? "90", 10) || 90),
  );
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (dias - 1));

  const sales = await prisma.sale.findMany({
    where: { organizationId: session.org, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      total: true,
      change: true,
      itemsCount: true,
      customer: { select: { name: true } },
      seller: { select: { name: true } },
      payments: { select: { method: true, amount: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(
    `vendas-${slug}-${dias}d-${today}.csv`,
    [
      "Venda",
      "Data",
      "Hora",
      "Cliente",
      "Vendedor",
      "Itens",
      "Subtotal",
      "Desconto",
      "Total",
      "Troco",
      "Pagamentos",
    ],
    sales.map((s) => [
      `#${s.id.slice(-6).toUpperCase()}`,
      s.createdAt.toISOString().slice(0, 10),
      s.createdAt.toISOString().slice(11, 16),
      s.customer?.name ?? "",
      s.seller?.name ?? "",
      s.itemsCount,
      csvMoney(money(s.subtotal)),
      csvMoney(money(s.discount)),
      csvMoney(money(s.total)),
      csvMoney(money(s.change)),
      s.payments
        .map((p) => `${p.method} ${csvMoney(money(p.amount))}`)
        .join(" + "),
    ]),
  );
}
