"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { suggestCrossSell, type Suggestion } from "@/lib/endurance/crosssell";
import { getOpenSession } from "@/lib/endurance/cash";
import { createReceivablesForSale } from "@/lib/endurance/finance";

type Result =
  | { ok: true; total: number; saleId: string }
  | { ok: false; error: string };

export interface CartItem {
  productId: string;
  qty: number;
}

export interface PaymentInput {
  method: string; // dinheiro | credito | debito | pix
  amount: number;
}

export interface FinalizeInput {
  items: CartItem[];
  token: string;
  customerId?: string | null;
  discount?: number;
  payments?: PaymentInput[];
}

const VALID_METHODS = ["dinheiro", "credito", "debito", "pix"];
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fecha a venda do PDV: valida estoque, aplica desconto, registra formas de
 * pagamento (split), baixa o saldo de cada produto e registra a venda — tudo
 * numa transação. Idempotente por `token` (protege contra duplo envio).
 */
export async function finalizeSaleAction(
  input: FinalizeInput,
): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };

  const { token } = input;
  if (!token) return { ok: false, error: "Token de venda ausente." };
  const existing = await prisma.sale.findUnique({ where: { token } });
  if (existing)
    return { ok: true, total: existing.total, saleId: existing.id };

  // Cliente (só se existir e for do mesmo espaço).
  let saleCustomerId: string | null = null;
  if (input.customerId) {
    const c = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (c && c.organizationId === s.org) saleCustomerId = c.id;
  }

  const clean = (input.items ?? []).filter(
    (i) => i && i.productId && Number.isFinite(i.qty) && i.qty > 0,
  );
  if (clean.length === 0) return { ok: false, error: "Carrinho vazio." };

  const ids = clean.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, organizationId: s.org },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const it of clean) {
    const p = byId.get(it.productId);
    if (!p) return { ok: false, error: "Produto não encontrado no seu espaço." };
    if (p.stock < it.qty)
      return {
        ok: false,
        error: `Estoque insuficiente de "${p.name}" (${p.stock} disponível).`,
      };
  }

  const subtotal = round2(
    clean.reduce((sum, it) => sum + byId.get(it.productId)!.price * it.qty, 0),
  );
  const discount = Math.min(Math.max(0, round2(input.discount ?? 0)), subtotal);
  const total = round2(subtotal - discount);
  const itemsCount = clean.reduce((n, it) => n + it.qty, 0);

  // Pagamentos (split). Se nenhum informado, assume dinheiro à vista.
  let payments = (input.payments ?? [])
    .filter((p) => p && VALID_METHODS.includes(p.method) && p.amount > 0)
    .map((p) => ({ method: p.method, amount: round2(p.amount) }));
  if (payments.length === 0) {
    payments = [{ method: "dinheiro", amount: total }];
  } else {
    const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
    if (paid + 0.01 < total)
      return { ok: false, error: "Pagamento insuficiente para o total." };
  }

  // Vincula a venda ao caixa aberto DO OPERADOR (multi-caixa por operador).
  const openSession = await getOpenSession(s.org, s.sub);

  let saleId = "";
  try {
    const results = await prisma.$transaction([
      ...clean.map((it) =>
        prisma.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        }),
      ),
      prisma.sale.create({
        data: {
          organizationId: s.org,
          customerId: saleCustomerId,
          userId: s.sub,
          cashSessionId: openSession?.id ?? null,
          token,
          subtotal,
          discount,
          total,
          itemsCount,
          items: {
            create: clean.map((it) => {
              const p = byId.get(it.productId)!;
              return {
                productId: p.id,
                name: p.name,
                quantity: it.qty,
                unitPrice: p.price,
              };
            }),
          },
          payments: { create: payments },
        },
      }),
    ]);
    saleId = (results[results.length - 1] as { id: string }).id;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const dup = await prisma.sale.findUnique({ where: { token } });
      if (dup) return { ok: true, total: dup.total, saleId: dup.id };
    }
    throw e;
  }

  // Gera os recebíveis financeiros da venda (cartão vira conta a receber).
  await createReceivablesForSale({
    organizationId: s.org,
    saleId,
    saleCode: `#${saleId.slice(-6).toUpperCase()}`,
    when: new Date(),
    payments,
  });

  revalidatePath(`/espaco/${s.slug}/m/pdv`);
  revalidatePath(`/espaco/${s.slug}/m/produtos`);
  revalidatePath(`/espaco/${s.slug}/m/estoque`);
  revalidatePath(`/espaco/${s.slug}/m/caixa`);
  revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  revalidatePath(`/espaco/${s.slug}`);
  return { ok: true, total, saleId };
}

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
}

export type CustomerData = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type CustomerResult =
  | { ok: true; customer: CustomerData }
  | { ok: false; error: string };

/** Cadastra um cliente do espaço (usado no PDV durante a venda). */
export async function createCustomerAction(
  input: CustomerInput,
): Promise<CustomerResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do cliente." };

  const c = await prisma.customer.create({
    data: {
      organizationId: s.org,
      name,
      phone: (input.phone ?? "").trim(),
      email: (input.email ?? "").trim(),
      document: (input.document ?? "").trim(),
    },
  });
  revalidatePath(`/espaco/${s.slug}/m/pdv`);
  return {
    ok: true,
    customer: { id: c.id, name: c.name, phone: c.phone, email: c.email },
  };
}

/** IA: sugestões de produtos complementares para a venda atual. */
export async function suggestCrossSellAction(
  cartProductIds: string[],
): Promise<{ ok: true; suggestions: Suggestion[] } | { ok: false }> {
  const s = await getSession();
  if (!s) return { ok: false };
  const suggestions = await suggestCrossSell(
    s.org,
    (cartProductIds ?? []).filter((x) => typeof x === "string"),
  );
  return { ok: true, suggestions };
}
