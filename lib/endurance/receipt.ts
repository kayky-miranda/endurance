import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { sendWhatsApp, type SendWhatsAppResult } from "./whatsapp-service";

type Money = Prisma.Decimal | number | string;

/**
 * Envio do recibo da venda por WhatsApp. O recibo é um TEXTO autocontido (a
 * página interna de recibo exige login do espaço, então não serve de link para
 * o cliente). Capturar o telefone para mandar o recibo também CADASTRA o cliente
 * no CRM e o vincula à venda — fechando o ciclo "comprou → recebeu recibo →
 * virou cliente".
 */

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

type SaleForReceipt = {
  id: string;
  total: Money;
  createdAt: Date;
  items: { name: string; quantity: number; unitPrice: Money }[];
  payments: { method: string; amount: Money }[];
};

/** Monta o texto do recibo (função pura/testável). */
export function buildReceiptMessage(
  orgName: string,
  sale: SaleForReceipt,
): string {
  const saleCode = `#${sale.id.slice(-6).toUpperCase()}`;
  const when = sale.createdAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lines = sale.items
    .slice(0, 12)
    .map((it) => `• ${it.quantity}x ${it.name} — ${brl(money(it.unitPrice) * it.quantity)}`);
  if (sale.items.length > 12) lines.push(`• …e mais ${sale.items.length - 12} item(ns)`);
  const formas = sale.payments
    .map((p) => PAY_LABEL[p.method] ?? p.method)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  return [
    `🧾 *${orgName}*`,
    `Recibo ${saleCode} · ${when}`,
    "",
    ...lines,
    "",
    `*Total: ${brl(money(sale.total))}*${formas ? ` (${formas})` : ""}`,
    "",
    "Obrigado pela preferência! 💚 Guarde este comprovante.",
  ].join("\n");
}

export interface SendReceiptInput {
  saleId: string;
  /** Telefone para envio (e cadastro). Se vazio, usa o do cliente da venda. */
  phone?: string;
  /** Nome para o cadastro quando a venda ainda não tem cliente. */
  name?: string;
}

export async function sendSaleReceipt(
  org: string,
  input: SendReceiptInput,
): Promise<SendWhatsAppResult> {
  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: { items: true, payments: true, customer: true, organization: true },
  });
  if (!sale || sale.organizationId !== org)
    return { ok: false, status: "falha", error: "Venda não encontrada." };

  const phone = (input.phone ?? "").trim();
  const toPhone = phone || sale.customer?.phone || "";
  if (!toPhone)
    return {
      ok: false,
      status: "falha",
      error: "Informe o telefone do cliente para enviar o recibo.",
    };

  // Cadastro/vínculo: venda sem cliente + telefone informado → cria o cliente e
  // o vincula à venda (é aqui que o cliente "entra" no estabelecimento).
  let customerId = sale.customerId;
  if (!customerId) {
    const created = await prisma.customer.create({
      data: {
        organizationId: org,
        name: (input.name ?? "").trim() || "Cliente",
        phone: toPhone,
      },
    });
    customerId = created.id;
    await prisma.sale.update({
      where: { id: sale.id },
      data: { customerId },
    });
  } else if (phone && sale.customer && !sale.customer.phone) {
    // Enriquece o cadastro existente com o telefone usado no recibo.
    await prisma.customer.update({ where: { id: customerId }, data: { phone } });
  }

  const body = buildReceiptMessage(sale.organization.name, sale);
  return sendWhatsApp(org, {
    toPhone,
    kind: "recibo",
    body,
    customerId,
  });
}
