import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiAuth, parsePagination, pageResponse } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/customers — lista clientes (paginado por cursor; ?q=). */
export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { limit, cursor } = parsePagination(req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  const rows = await prisma.customer.findMany({
    where: {
      organizationId: auth.org,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { document: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return pageResponse(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      document: c.document,
      created_at: c.createdAt.toISOString(),
    })),
    limit,
  );
}
