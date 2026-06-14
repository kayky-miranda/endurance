import "server-only";
import { createMetaCloudProvider } from "./whatsapp-providers/meta-cloud";

/**
 * Abstração de PROVEDOR de WhatsApp Business (envio outbound).
 *
 * Mesmo padrão dos provedores fiscal/PIX: o adapter fala com a API (Meta Cloud
 * API) e devolve ok + id da mensagem; aqui só resolvemos o caminho. O token do
 * WhatsApp fica em variável de ambiente no servidor; os identificadores
 * não-secretos (phoneNumberId) ficam na config da empresa.
 *
 * Segurança: envio REAL é travado por padrão. provider="meta" exige WHATSAPP_TOKEN
 * E a flag WHATSAPP_ALLOW_SEND=true. Sem provider configurado, cai no modo
 * SIMULADO (apenas registra a mensagem, não envia). Nunca envia silenciosamente.
 */

export interface WhatsAppSendInput {
  to: string;
  body?: string;
  templateName?: string;
  templateVars?: string[];
}

export interface WhatsAppSendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface WhatsAppProvider {
  id: string;
  sendText(to: string, body: string): Promise<WhatsAppSendResult>;
  sendTemplate(
    to: string,
    templateName: string,
    vars: string[],
  ): Promise<WhatsAppSendResult>;
}

export interface WhatsAppConfigLike {
  provider: string; // "" simulado | "meta"
  phoneNumberId: string;
  enabled: boolean;
}

export type WhatsAppResolution =
  | { kind: "simulate" }
  | { kind: "provider"; provider: WhatsAppProvider }
  | { kind: "error"; error: string };

const META_BASE = "https://graph.facebook.com/v19.0";

export function resolveWhatsAppProvider(
  cfg: WhatsAppConfigLike,
  deps?: { fetchImpl?: typeof fetch },
): WhatsAppResolution {
  if (cfg.provider !== "meta") return { kind: "simulate" };
  if (!cfg.enabled) return { kind: "simulate" };

  const token = process.env.WHATSAPP_TOKEN;
  if (!token)
    return { kind: "error", error: "Token do WhatsApp não configurado no servidor." };
  if (!cfg.phoneNumberId)
    return {
      kind: "error",
      error: "Configure o Phone Number ID do WhatsApp Business.",
    };
  if (process.env.WHATSAPP_ALLOW_SEND !== "true")
    return {
      kind: "error",
      error:
        "Envio real de WhatsApp está desabilitado nesta instalação. Habilite WHATSAPP_ALLOW_SEND no servidor.",
    };

  const provider = createMetaCloudProvider({
    token,
    phoneNumberId: cfg.phoneNumberId,
    baseUrl: META_BASE,
    fetchImpl: deps?.fetchImpl,
  });
  return { kind: "provider", provider };
}
