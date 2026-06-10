"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

export interface NewProduct {
  name: string;
  barcode?: string;
  category?: string;
  price?: number;
  stock?: number;
}

function revalidate(slug: string) {
  revalidatePath(`/espaco/${slug}/m/produtos`);
  revalidatePath(`/espaco/${slug}/m/estoque`);
  revalidatePath(`/espaco/${slug}`);
}

export async function createProductAction(input: NewProduct): Promise<Result> {
  const gate = await requirePermission("products.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do produto." };

  const barcode = (input.barcode ?? "").trim();
  if (barcode) {
    const dup = await prisma.product.findFirst({
      where: { organizationId: s.org, barcode },
    });
    if (dup)
      return {
        ok: false,
        error: "Já existe um produto com esse código de barras.",
      };
  }

  await prisma.product.create({
    data: {
      organizationId: s.org,
      name,
      barcode,
      category: (input.category ?? "").trim(),
      price: Math.max(0, Number(input.price) || 0),
      stock: Math.max(0, Math.trunc(Number(input.stock) || 0)),
    },
  });
  revalidate(s.slug);
  return { ok: true };
}

export async function deleteProductAction(id: string): Promise<Result> {
  const gate = await requirePermission("products.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const p = await prisma.product.findUnique({ where: { id } });
  if (!p || p.organizationId !== s.org)
    return { ok: false, error: "Produto não encontrado." };

  await prisma.product.delete({ where: { id } });
  revalidate(s.slug);
  return { ok: true };
}

export async function adjustStockAction(
  id: string,
  delta: number,
): Promise<Result> {
  const gate = await requirePermission("stock.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const p = await prisma.product.findUnique({ where: { id } });
  if (!p || p.organizationId !== s.org)
    return { ok: false, error: "Produto não encontrado." };

  const next = Math.max(0, p.stock + Math.trunc(delta));
  await prisma.product.update({ where: { id }, data: { stock: next } });
  revalidate(s.slug);
  return { ok: true };
}
