import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { apiAuth, parsePagination, pageResponse } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products — lista o catálogo (paginado por cursor).
 * Filtros: ?q= (nome/código de barras/SKU), ?limit=, ?cursor=.
 */
export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { limit, cursor } = parsePagination(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  const rows = await prisma.product.findMany({
    where: {
      organizationId: auth.org,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return pageResponse(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      ncm: p.ncm,
      price: money(p.price),
      cost: money(p.cost),
      stock: p.stock,
      min_stock: p.minStock,
      created_at: p.createdAt.toISOString(),
    })),
    limit,
  );
}
