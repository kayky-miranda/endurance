"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  sendWhatsApp,
  type WhatsAppKind,
  type SendWhatsAppResult,
} from "@/lib/endurance/whatsapp-service";
import { sendSaleReceipt } from "@/lib/endurance/receipt";

/**
 * Envio de WhatsApp a partir das telas (notificações/CRM). Gate em
 * `integrations.config` (mesma permissão do módulo Notificações). Sempre
 * registra a mensagem (auditoria); no modo simulado não envia de fato.
 */
export async function sendWhatsAppAction(input: {
  toPhone: string;
  body: string;
  kind?: WhatsAppKind;
  customerId?: string | null;
}): Promise<SendWhatsAppResult> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return { ok: false, status: "falha", error: gate.error };
  return sendWhatsApp(gate.session.org, {
    toPhone: input.toPhone,
    body: input.body,
    kind: input.kind ?? "crm",
    customerId: input.customerId ?? null,
  });
}

/**
 * Envia o recibo da venda por WhatsApp. Gate em `pdv.sell` — quem opera o caixa
 * envia o recibo. Captura o telefone (e cadastra o cliente, se ainda não houver).
 */
export async function sendSaleReceiptAction(input: {
  saleId: string;
  phone?: string;
  name?: string;
}): Promise<SendWhatsAppResult> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return { ok: false, status: "falha", error: gate.error };
  const res = await sendSaleReceipt(gate.session.org, input);
  if (res.ok) {
    revalidatePath(`/espaco/${gate.session.slug}/m/crm`);
    revalidatePath(`/espaco/${gate.session.slug}/m/pdv`);
  }
  return res;
}
