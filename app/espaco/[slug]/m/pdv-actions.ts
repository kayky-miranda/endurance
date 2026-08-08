"use server";

import { revalidatePath } from "next/cache";
import { withAiCredit } from "@/lib/endurance/ai-credits";
import { prisma } from "@/lib/db";
import { getSession, requirePermission } from "@/lib/auth";
import { FinalizeSaleSchema, CustomerSchema, ProductSchema, firstError } from "@/lib/validation";
import { suggestCrossSell, type Suggestion } from "@/lib/endurance/crosssell";
import { getOpenSession } from "@/lib/endurance/cash";
import { resolveUserLocation } from "@/lib/endurance/locations";
import { logActivity } from "@/lib/endurance/activity-log";
import { createReceivablesForSale } from "@/lib/endurance/finance";
import { money } from "@/lib/endurance/money";
import {
  applyStockMovement,
  InsufficientStockError,
} from "@/lib/endurance/stock-ledger";

type Result =
  | { ok: true; total: number; saleId: string; change: number }
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
  /** Cobrança PIX já confirmada (paga) que cobre a parcela pix da venda. */
  pixChargeId?: string | null;
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
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate;
  const s = gate.session;

  // Higiene de dados na porta: NaN, quantidade fracionária/absurda, método de
  // pagamento desconhecido etc. param aqui com mensagem clara (não com 500).
  const v = FinalizeSaleSchema.safeParse(input);
  if (!v.success) return { ok: false, error: firstError(v.error) };
  input = { ...input, ...v.data };

  const { token } = input;
  if (!token) return { ok: false, error: "Token de venda ausente." };
  const existing = await prisma.sale.findUnique({ where: { token } });
  if (existing)
    return {
      ok: true,
      total: money(existing.total),
      saleId: existing.id,
      change: money(existing.change),
    };

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
  // A venda baixa o estoque DO LOCAL em que o operador trabalha — a checagem
  // prévia (mensagem amigável) usa o saldo de lá, não o total da rede.
  const locationId = await resolveUserLocation(s.org, s.sub);
  const [products, localStocks] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids }, organizationId: s.org } }),
    prisma.productStock.findMany({
      where: { productId: { in: ids }, locationId },
      select: { productId: true, qty: true },
    }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const qtyHere = new Map(localStocks.map((r) => [r.productId, r.qty]));

  for (const it of clean) {
    const p = byId.get(it.productId);
    if (!p) return { ok: false, error: "Produto não encontrado no seu espaço." };
    const available = qtyHere.get(it.productId) ?? 0;
    if (available < it.qty)
      return {
        ok: false,
        error: `Estoque insuficiente de "${p.name}" (${available} disponível neste local).`,
      };
  }

  const subtotal = round2(
    clean.reduce(
      (sum, it) => sum + money(byId.get(it.productId)!.price) * it.qty,
      0,
    ),
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

  // Troco: o excedente pago volta em dinheiro, então precisa estar coberto pelo
  // que entrou em dinheiro (cartão/pix não geram troco). Os pagamentos são
  // persistidos pelo valor LÍQUIDO — o que fica na gaveta — e o troco é
  // registrado na venda, mantendo gaveta, recebíveis e fiscal consistentes.
  const paidTotal = round2(payments.reduce((a, p) => a + p.amount, 0));
  const change = round2(Math.max(0, paidTotal - total));
  if (change > 0) {
    const cashPaid = round2(
      payments
        .filter((p) => p.method === "dinheiro")
        .reduce((a, p) => a + p.amount, 0),
    );
    // Cartão/Pix cobram o valor exato — acima do total é erro de digitação
    // (ex.: forma de pagamento adicionada duas vezes), não caso de troco.
    const nonCash = round2(paidTotal - cashPaid);
    if (nonCash > total + 0.01)
      return {
        ok: false,
        error:
          "Cartão/Pix somam mais que o total da venda — confira as formas de pagamento (alguma foi adicionada duas vezes?).",
      };
    if (cashPaid + 0.01 < change)
      return {
        ok: false,
        error: "Troco maior que o recebido em dinheiro — ajuste os valores.",
      };
    let toDeduct = change;
    payments = payments
      .map((p) => {
        if (p.method !== "dinheiro" || toDeduct <= 0) return p;
        const d = Math.min(p.amount, toDeduct);
        toDeduct = round2(toDeduct - d);
        return { ...p, amount: round2(p.amount - d) };
      })
      .filter((p) => p.amount > 0);
  }

  // PIX: a parcela paga em PIX exige uma cobrança JÁ CONFIRMADA (paga), do mesmo
  // token e valor. O fluxo do PDV é assíncrono: gera o QR, o cliente paga, a
  // cobrança vira `pago`, e só então a venda é finalizada com este id.
  const pixTotal = round2(
    payments.filter((p) => p.method === "pix").reduce((a, p) => a + p.amount, 0),
  );
  let pixCharge: { id: string; txid: string } | null = null;
  if (pixTotal > 0) {
    const chId = (input.pixChargeId ?? "").trim();
    if (!chId)
      return { ok: false, error: "Confirme o pagamento PIX antes de finalizar." };
    const ch = await prisma.pixCharge.findUnique({ where: { id: chId } });
    if (!ch || ch.organizationId !== s.org)
      return { ok: false, error: "Cobrança PIX não encontrada." };
    if (ch.token !== token)
      return { ok: false, error: "Cobrança PIX não corresponde a esta venda." };
    if (ch.status !== "pago")
      return { ok: false, error: "O pagamento PIX ainda não foi confirmado." };
    if (ch.saleId)
      return { ok: false, error: "Cobrança PIX já vinculada a outra venda." };
    if (Math.abs(money(ch.amount) - pixTotal) > 0.01)
      return { ok: false, error: "Valor pago em PIX difere da parcela da venda." };
    pixCharge = { id: ch.id, txid: ch.txid };
  }

  // Vincula a venda ao caixa aberto DO OPERADOR (multi-caixa por operador).
  const openSession = await getOpenSession(s.org, s.sub);

  let saleId = "";
  try {
    saleId = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          organizationId: s.org,
          customerId: saleCustomerId,
          userId: s.sub,
          cashSessionId: openSession?.id ?? null,
          locationId,
          token,
          subtotal,
          discount,
          total,
          change,
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
      });

      // Baixa de estoque pelo RAZÃO (saída/venda): condicional/race-safe e com
      // registro auditável (saldo anterior→posterior, documento, responsável).
      // Se faltar saldo, InsufficientStockError reverte a venda inteira.
      for (const it of clean) {
        await applyStockMovement(tx, {
          organizationId: s.org,
          productId: it.productId,
          delta: -it.qty,
          reason: "venda",
          refType: "sale",
          refId: sale.id,
          actor: { id: s.sub, name: s.name },
          locationId,
        });
      }

      // Recebíveis na MESMA transação: venda sem lançamento financeiro (ou
      // vice-versa) nunca persiste.
      await createReceivablesForSale(
        {
          organizationId: s.org,
          saleId: sale.id,
          saleCode: `#${sale.id.slice(-6).toUpperCase()}`,
          when: new Date(),
          payments,
        },
        tx,
      );

      // Conciliação imediata da parcela PIX: liga a cobrança à venda e marca o
      // recebível pix como conciliado (cobrança ↔ recebível batidos no fato).
      if (pixCharge) {
        const now = new Date();
        await tx.pixCharge.update({
          where: { id: pixCharge.id },
          data: { saleId: sale.id, reconciledAt: now },
        });
        await tx.financialEntry.updateMany({
          where: { saleId: sale.id, method: "pix" },
          data: { reconciledAt: now, externalRef: pixCharge.txid },
        });
      }

      return sale.id;
    });
  } catch (e) {
    if (e instanceof InsufficientStockError)
      return { ok: false, error: e.message };
    if ((e as { code?: string }).code === "P2002") {
      const dup = await prisma.sale.findUnique({ where: { token } });
      if (dup)
        return {
          ok: true,
          total: money(dup.total),
          saleId: dup.id,
          change: money(dup.change),
        };
    }
    throw e;
  }

  revalidatePath(`/espaco/${s.slug}/m/pdv`);
  revalidatePath(`/espaco/${s.slug}/m/produtos`);
  revalidatePath(`/espaco/${s.slug}/m/estoque`);
  revalidatePath(`/espaco/${s.slug}/m/caixa`);
  revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  revalidatePath(`/espaco/${s.slug}`);
  return { ok: true, total, saleId, change };
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
  /** CPF/CNPJ — o PDV precisa dele para avisar que CNPJ não vai em NFC-e. */
  document: string;
};

export type CustomerResult =
  | { ok: true; customer: CustomerData }
  | { ok: false; error: string };

/** Cadastra um cliente do espaço (usado no PDV durante a venda). */
export async function createCustomerAction(
  input: CustomerInput,
): Promise<CustomerResult> {
  const gate = await requirePermission("customers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const v = CustomerSchema.safeParse(input);
  if (!v.success) return { ok: false, error: firstError(v.error) };
  const { name, phone, email, document } = v.data;

  const c = await prisma.customer.create({
    data: { organizationId: s.org, name, phone, email, document },
  });
  revalidatePath(`/espaco/${s.slug}/m/pdv`);
  return {
    ok: true,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      document: c.document ?? "",
    },
  };
}

/** IA: sugestões de produtos complementares para a venda atual. */
export async function suggestCrossSellAction(
  cartProductIds: string[],
): Promise<{ ok: true; suggestions: Suggestion[] } | { ok: false }> {
  const s = await getSession();
  if (!s) return { ok: false };
  const ids = (cartProductIds ?? []).filter((x) => typeof x === "string");
  const out = await withAiCredit(s.org, "crosssell", async () => {
    const r = await suggestCrossSell(s.org, ids);
    // A heurística por categoria é local e não custa chamada ao modelo.
    return { value: r, delivered: r.length > 0, fallback: false };
  });
  // Sem crédito, o caixa segue funcionando sem sugestão — nunca trava a venda.
  const suggestions = out.ok ? out.value : [];
  return { ok: true, suggestions };
}

/** Produto no formato que o PDV consome no carrinho. */
export type QuickProduct = {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
};

/**
 * Cadastro RÁPIDO de produto durante a venda: o operador topou com um item
 * que não estava no catálogo e não pode largar o carrinho para cadastrá-lo.
 * Cria o produto (com estoque inicial no local do operador, pelo razão) e
 * devolve o item pronto para entrar no carrinho — sem recarregar a página.
 *
 * Exige a permissão de cadastro de produtos: quem só vende não cria item.
 */
export async function quickCreateProductAction(input: {
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category?: string;
}): Promise<{ ok: true; product: QuickProduct } | { ok: false; error: string }> {
  const gate = await requirePermission("products.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;

  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, barcode, category, price, stock: initial } = parsed.data;

  if (barcode) {
    const dup = await prisma.product.findFirst({
      where: { organizationId: s.org, barcode },
      select: { id: true },
    });
    if (dup)
      return { ok: false, error: "Já existe um produto com esse código de barras." };
  }

  const locationId = await resolveUserLocation(s.org, s.sub);
  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: { organizationId: s.org, name, barcode, category, price, stock: 0 },
    });
    if (initial > 0)
      await applyStockMovement(tx, {
        organizationId: s.org,
        productId: p.id,
        delta: initial,
        reason: "saldo_inicial",
        refType: "initial",
        actor: { id: s.sub, name: s.name },
        locationId,
      });
    return p;
  });

  await logActivity(
    s,
    "product.create",
    `Cadastrou o produto ${name} (rápido, no PDV)`,
    created.id,
  );
  revalidatePath(`/espaco/${s.slug}/m/produtos`);
  revalidatePath(`/espaco/${s.slug}/m/estoque`);
  return {
    ok: true,
    product: {
      id: created.id,
      name: created.name,
      barcode: created.barcode,
      category: created.category,
      price: money(created.price),
      stock: initial,
    },
  };
}
