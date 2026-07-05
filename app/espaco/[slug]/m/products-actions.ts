"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { ProductSchema, StockAdjustSchema, firstError } from "@/lib/validation";
import {
  applyStockMovement,
  InsufficientStockError,
} from "@/lib/endurance/stock-ledger";

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

  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, barcode, category, price, stock: initial } = parsed.data;

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

  // Cria com saldo 0 e registra o estoque inicial pelo RAZÃO (entrada
  // "saldo_inicial"), para que toda existência de saldo tenha origem auditável.
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        organizationId: s.org,
        name,
        barcode,
        category,
        price,
        stock: 0,
      },
    });
    if (initial > 0) {
      await applyStockMovement(tx, {
        organizationId: s.org,
        productId: p.id,
        delta: initial,
        reason: "saldo_inicial",
        refType: "initial",
        actor: { id: s.sub, name: s.name },
      });
    }
    return p;
  });
  revalidate(s.slug);
  await logActivity(s, "product.create", `Cadastrou o produto ${name}`, created.id);
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
  await logActivity(s, "product.delete", `Removeu o produto ${p.name}`, id);
  return { ok: true };
}

export async function adjustStockAction(
  id: string,
  delta: number,
): Promise<Result> {
  const gate = await requirePermission("stock.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const parsed = StockAdjustSchema.safeParse({ id, delta });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id: productId, delta: move } = parsed.data;

  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || p.organizationId !== s.org)
    return { ok: false, error: "Produto não encontrado." };

  if (move === 0) return { ok: true };

  // Ajuste manual pelo RAZÃO (entrada/saída de ajuste), com saldo e responsável.
  try {
    const r = await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        organizationId: s.org,
        productId,
        delta: move,
        reason: move > 0 ? "ajuste_entrada" : "ajuste_saida",
        refType: "adjust",
        actor: { id: s.sub, name: s.name },
      }),
    );
    revalidate(s.slug);
    await logActivity(
      s,
      "stock.adjust",
      `Ajustou estoque de ${p.name}: ${r.before} → ${r.after} (${move >= 0 ? "+" : ""}${move})`,
      productId,
    );
    return { ok: true };
  } catch (e) {
    if (e instanceof InsufficientStockError)
      return { ok: false, error: e.message };
    throw e;
  }
}
