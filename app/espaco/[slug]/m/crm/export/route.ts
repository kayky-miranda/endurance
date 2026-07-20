import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { money } from "@/lib/endurance/money";
import { csvResponse, csvMoney } from "@/lib/endurance/csv";

// Exporta os clientes com total comprado e nº de compras.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "customers.manage"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const [customers, salesByCustomer] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: session.org },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { organizationId: session.org, customerId: { not: null } },
      _sum: { total: true },
      _count: true,
    }),
  ]);
  const stats = new Map(
    salesByCustomer.map((s) => [
      s.customerId as string,
      { total: money(s._sum.total ?? 0), compras: s._count },
    ]),
  );

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(
    `clientes-${slug}-${today}.csv`,
    ["Nome", "Telefone", "E-mail", "Documento", "Compras", "Total comprado", "Cliente desde"],
    customers.map((c) => {
      const s = stats.get(c.id);
      return [
        c.name,
        c.phone,
        c.email,
        c.document,
        s?.compras ?? 0,
        csvMoney(s?.total ?? 0),
        c.createdAt.toISOString().slice(0, 10),
      ];
    }),
  );
}
