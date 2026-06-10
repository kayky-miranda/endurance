"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, sessionHasPermission } from "@/lib/auth";
import { internalEan13 } from "@/lib/endurance/barcode";

type R = { ok: true; barcode: string } | { ok: false; error: string };

/** Garante que o produto é do espaço e que o usuário pode gerenciar produtos. */
async function guard(productId: string) {
  const s = await getSession();
  if (!s) return { ok: false as const, error: "Sessão expirada." };
  if (!sessionHasPermission(s, "products.manage"))
    return { ok: false as const, error: "Sem permissão para gerenciar produtos." };
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || p.organizationId !== s.org)
    return { ok: false as const, error: "Produto não encontrado." };
  return { ok: true as const, s, p };
}

/** Gera um EAN-13 interno único para um produto que ainda não tem código. */
export async function generateBarcodeAction(productId: string): Promise<R> {
  const g = await guard(productId);
  if (!g.ok) return { ok: false, error: g.error };

  // Tenta gerar um código único (colisão é raríssima; tenta algumas vezes).
  let barcode = "";
  for (let i = 0; i < 8; i++) {
    const candidate = internalEan13(
      g.p.id.replace(/\D/g, "") + Date.now().toString().slice(-4) + i,
    );
    const taken = await prisma.product.findFirst({
      where: { organizationId: g.s.org, barcode: candidate, NOT: { id: g.p.id } },
      select: { id: true },
    });
    if (!taken) {
      barcode = candidate;
      break;
    }
  }
  if (!barcode) return { ok: false, error: "Não consegui gerar um código único." };

  await prisma.product.update({ where: { id: g.p.id }, data: { barcode } });
  revalidatePath(`/espaco/${g.s.slug}/m/codigo_barras`);
  return { ok: true, barcode };
}

/** Define manualmente o código de barras de um produto. */
export async function setBarcodeAction(
  productId: string,
  raw: string,
): Promise<R> {
  const g = await guard(productId);
  if (!g.ok) return { ok: false, error: g.error };

  const barcode = (raw ?? "").trim().slice(0, 32);
  if (!barcode) return { ok: false, error: "Informe um código." };
  const taken = await prisma.product.findFirst({
    where: { organizationId: g.s.org, barcode, NOT: { id: g.p.id } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "Esse código já está em uso." };

  await prisma.product.update({ where: { id: g.p.id }, data: { barcode } });
  revalidatePath(`/espaco/${g.s.slug}/m/codigo_barras`);
  return { ok: true, barcode };
}
