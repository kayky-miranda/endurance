import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { apiAuth, parsePagination, pageResponse } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/sales — vendas com itens e pagamentos (paginado por cursor).
 * Filtros: ?since=AAAA-MM-DD (default: últimos 30 dias), ?limit=, ?cursor=.
 */
export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { limit, cursor } = parsePagination(req);
  const sinceRaw = new URL(req.url).searchParams.get("since") ?? "";
  let since = new Date();
  since.setDate(since.getDate() - 30);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sinceRaw)) {
    const d = new Date(`${sinceRaw}T00:00:00`);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const rows = await prisma.sale.findMany({
    where: { organizationId: auth.org, createdAt: { gte: since } },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      total: true,
      change: true,
      customer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      items: {
        select: { productId: true, name: true, quantity: true, unitPrice: true },
      },
      payments: { select: { method: true, amount: true } },
    },
  });

  return pageResponse(
    rows.map((s) => ({
      id: s.id,
      code: `#${s.id.slice(-6).toUpperCase()}`,
      created_at: s.createdAt.toISOString(),
      subtotal: money(s.subtotal),
      discount: money(s.discount),
      total: money(s.total),
      change: money(s.change),
      customer: s.customer ? { id: s.customer.id, name: s.customer.name } : null,
      seller: s.seller ? { id: s.seller.id, name: s.seller.name } : null,
      items: s.items.map((i) => ({
        product_id: i.productId,
        name: i.name,
        quantity: i.quantity,
        unit_price: money(i.unitPrice),
      })),
      payments: s.payments.map((p) => ({ method: p.method, amount: money(p.amount) })),
    })),
    limit,
  );
}
