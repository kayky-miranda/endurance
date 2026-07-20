import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/endurance/permissions";
import { getCount } from "@/lib/endurance/stock-count";
import { csvResponse, csvMoney } from "@/lib/endurance/csv";

// Exporta os itens de uma conferência (sistema × físico × divergência).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!hasPermission(session.role, session.permissions, "count.manage"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const count = await getCount(session.org, id);
  if (!count) return new NextResponse("Conferência não encontrada.", { status: 404 });

  return csvResponse(
    `${count.number.toLowerCase()}.csv`,
    [
      "Produto",
      "Código de barras",
      "SKU",
      "Categoria",
      "Sistema",
      "Físico",
      "Divergência",
      "Custo unitário",
      "Valor divergência",
      "Observação",
    ],
    count.items.map((it) => {
      const div = it.countedQty == null ? null : it.countedQty - it.systemQty;
      return [
        it.productName,
        it.barcode,
        it.sku,
        it.category,
        it.systemQty,
        it.countedQty ?? "",
        div ?? "",
        csvMoney(it.unitCost),
        div == null ? "" : csvMoney(Math.abs(div) * it.unitCost),
        it.note,
      ];
    }),
  );
}
