import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { money } from "@/lib/endurance/money";
import { csvResponse, csvMoney } from "@/lib/endurance/csv";

// Exporta o catálogo completo (todas as páginas) em CSV.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "products.manage"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const rows = await prisma.product.findMany({
    where: { organizationId: session.org },
    orderBy: { name: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(
    `produtos-${slug}-${today}.csv`,
    [
      "Nome",
      "Código de barras",
      "SKU",
      "Categoria",
      "Unidade",
      "NCM",
      "Preço",
      "Custo",
      "Estoque",
      "Estoque mínimo",
    ],
    rows.map((p) => [
      p.name,
      p.barcode,
      p.sku,
      p.category,
      p.unit,
      p.ncm,
      csvMoney(money(p.price)),
      csvMoney(money(p.cost)),
      p.stock,
      p.minStock,
    ]),
  );
}
