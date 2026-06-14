import "server-only";
import { prisma } from "@/lib/db";
import { resolveWhatsAppProvider } from "./whatsapp-provider";

/**
 * Camada de serviço do WhatsApp: config + envio + log. Cada envio vira um
 * registro em `WhatsAppMessage` (auditoria/entrega). No modo SIMULADO apenas
 * registra (não envia); no modo real (Meta) envia e grava o id da mensagem.
 */

export interface WhatsAppConfigView {
  provider: string;
  phoneNumberId: string;
  remetente: string;
  enabled: boolean;
  configured: boolean;
}

export async function ensureWhatsAppConfig(org: string) {
  const existing = await prisma.whatsAppConfig.findUnique({
    where: { organizationId: org },
  });
  if (existing) return existing;
  return prisma.whatsAppConfig.create({ data: { organizationId: org } });
}

export async function getWhatsAppConfigView(
  org: string,
): Promise<WhatsAppConfigView> {
  const c = await ensureWhatsAppConfig(org);
  return {
    provider: c.provider,
    phoneNumberId: c.phoneNumberId,
    remetente: c.remetente,
    enabled: c.enabled,
    configured: c.provider === "meta" ? Boolean(c.phoneNumberId) : true,
  };
}

export interface SaveWhatsAppConfigInput {
  provider: string; // "" | "meta"
  phoneNumberId: string;
  remetente: string;
  enabled: boolean;
}

export async function saveWhatsAppConfig(
  org: string,
  input: SaveWhatsAppConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const provider = input.provider === "meta" ? "meta" : "";
  await prisma.whatsAppConfig.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      provider,
      phoneNumberId: (input.phoneNumberId ?? "").trim().slice(0, 60),
      remetente: (input.remetente ?? "").trim().slice(0, 60),
      enabled: Boolean(input.enabled),
    },
    update: {
      provider,
      phoneNumberId: (input.phoneNumberId ?? "").trim().slice(0, 60),
      remetente: (input.remetente ?? "").trim().slice(0, 60),
      enabled: Boolean(input.enabled),
    },
  });
  return { ok: true };
}

export type WhatsAppKind = "pix" | "recibo" | "crm" | "manual";

export interface SendWhatsAppInput {
  toPhone: string;
  kind: WhatsAppKind;
  body?: string;
  templateName?: string;
  templateVars?: string[];
  customerId?: string | null;
}

export interface SendWhatsAppResult {
  ok: boolean;
  error?: string;
  simulated?: boolean;
  status: string;
}

/** Envia (ou simula) uma mensagem e registra em WhatsAppMessage. */
export async function sendWhatsApp(
  org: string,
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  const toPhone = (input.toPhone ?? "").trim();
  if (!toPhone) return { ok: false, status: "falha", error: "Telefone ausente." };
  const body = (input.body ?? "").trim();
  if (!body && !input.templateName)
    return { ok: false, status: "falha", error: "Mensagem vazia." };

  const cfg = await ensureWhatsAppConfig(org);
  const resolution = resolveWhatsAppProvider(cfg);

  // Erro de configuração (ex.: provider meta sem token): registra como falha.
  if (resolution.kind === "error") {
    await logMessage(org, input, "falha", "", "", resolution.error);
    return { ok: false, status: "falha", error: resolution.error };
  }

  // SIMULADO: só registra (não envia).
  if (resolution.kind === "simulate") {
    await logMessage(org, input, "enviado", "", "");
    return { ok: true, status: "enviado", simulated: true };
  }

  // REAL: envia pela Meta Cloud API.
  const r =
    input.templateName && !body
      ? await resolution.provider.sendTemplate(
          toPhone,
          input.templateName,
          input.templateVars ?? [],
        )
      : await resolution.provider.sendText(toPhone, body);

  const status = r.ok ? "enviado" : "falha";
  await logMessage(
    org,
    input,
    status,
    resolution.provider.id,
    r.providerRef ?? "",
    r.error ?? "",
  );
  return { ok: r.ok, status, error: r.error };
}

async function logMessage(
  org: string,
  input: SendWhatsAppInput,
  status: string,
  provider: string,
  providerRef: string,
  error = "",
): Promise<void> {
  await prisma.whatsAppMessage.create({
    data: {
      organizationId: org,
      customerId: input.customerId ?? null,
      toPhone: input.toPhone.slice(0, 30),
      kind: input.kind,
      body: (input.body ?? "").slice(0, 4096),
      templateName: input.templateName ?? "",
      status,
      provider,
      providerRef,
      error: error.slice(0, 300),
      sentAt: status === "enviado" ? new Date() : null,
    },
  });
}

/** Atualiza o status de entrega de uma mensagem pelo id do provedor (webhook). */
export async function updateMessageStatusByRef(
  providerRef: string,
  status: string,
): Promise<void> {
  if (!providerRef) return;
  const allowed = ["enviado", "entregue", "lido", "falha"];
  if (!allowed.includes(status)) return;
  await prisma.whatsAppMessage.updateMany({
    where: { providerRef },
    data: { status },
  });
}
