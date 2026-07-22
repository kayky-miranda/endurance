"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { transferStock } from "@/lib/endurance/stock-ledger";

/** Busca produtos mostrando o saldo NO LOCAL DE ORIGEM da transferência. */
export async function searchForTransferAction(
  query: string,
  fromLocationId: string,
): Promise<{
  ok: boolean;
  error?: string;
  products?: { id: string; name: string; barcode: string; qty: number }[];
}> {
  const gate = await requirePermission("stock.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  const q = query.trim();
  if (!q) return { ok: true, products: [] };

  const rows = await prisma.product.findMany({
    where: {
      organizationId: s.org,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 15,
    select: {
      id: true,
      name: true,
      barcode: true,
      locationStocks: {
        where: { locationId: fromLocationId },
        select: { qty: true },
      },
    },
  });
  return {
    ok: true,
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      qty: p.locationStocks[0]?.qty ?? 0,
    })),
  };
}

export async function transferStockAction(input: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("stock.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = await transferStock(s.org, {
    ...input,
    actor: { id: s.sub, name: s.name },
  });
  if (!res.ok) return res;

  const p = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { name: true },
  });
  await logActivity(
    s,
    "stock.transfer",
    `Transferiu ${input.quantity} un. de ${p?.name ?? "produto"} entre locais`,
    input.productId,
  );
  revalidatePath(`/espaco/${s.slug}/m/transferencias`);
  revalidatePath(`/espaco/${s.slug}/m/estoque`);
  revalidatePath(`/espaco/${s.slug}/m/movimentacoes`);
  return { ok: true };
}
