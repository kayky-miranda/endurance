"use server";

import { requirePermission } from "@/lib/auth";
import {
  sendWhatsApp,
  type WhatsAppKind,
  type SendWhatsAppResult,
} from "@/lib/endurance/whatsapp-service";

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
