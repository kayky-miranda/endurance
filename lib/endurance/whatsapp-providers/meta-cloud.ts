import "server-only";
import type {
  WhatsAppProvider,
  WhatsAppSendResult,
} from "../whatsapp-provider";

/**
 * Adapter da Meta Cloud API (WhatsApp Business) para envio outbound.
 *
 * API: POST /{phoneNumberId}/messages, Bearer token. Texto livre (`type:"text"`)
 * só é permitido dentro da janela de 24h; fora dela use `type:"template"` com um
 * template aprovado. O `fetch` é injetável para testes sem rede.
 */

/**
 * Normaliza o telefone para E.164 sem o "+", assumindo Brasil quando vem sem
 * código de país (10 díg. fixo / 11 díg. celular). Função pura/testável.
 */
export function normalizePhoneBR(phone: string): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  // 10 (fixo DDD+8) ou 11 (celular DDD+9) dígitos → falta o país (55).
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

interface MetaResponse {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number };
}

export interface MetaCloudDeps {
  token: string;
  phoneNumberId: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createMetaCloudProvider(deps: MetaCloudDeps): WhatsAppProvider {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const base = deps.baseUrl.replace(/\/$/, "");

  async function post(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
    try {
      const res = await fetchImpl(`${base}/${deps.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deps.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      });
      let data: MetaResponse = {};
      try {
        data = (await res.json()) as MetaResponse;
      } catch {
        data = {};
      }
      const id = data.messages?.[0]?.id;
      if (res.ok && id) return { ok: true, providerRef: id };
      return {
        ok: false,
        error: data.error?.message ?? "Falha ao enviar a mensagem no WhatsApp.",
      };
    } catch (e) {
      return {
        ok: false,
        error: `Falha de comunicação com o WhatsApp: ${(e as Error)?.message ?? e}`,
      };
    }
  }

  return {
    id: "meta",

    async sendText(to: string, body: string): Promise<WhatsAppSendResult> {
      const phone = normalizePhoneBR(to);
      if (!phone) return { ok: false, error: "Telefone do destinatário inválido." };
      return post({
        to: phone,
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4096) },
      });
    },

    async sendTemplate(
      to: string,
      templateName: string,
      vars: string[],
    ): Promise<WhatsAppSendResult> {
      const phone = normalizePhoneBR(to);
      if (!phone) return { ok: false, error: "Telefone do destinatário inválido." };
      const components = vars.length
        ? [
            {
              type: "body",
              parameters: vars.map((t) => ({ type: "text", text: t })),
            },
          ]
        : undefined;
      return post({
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
          ...(components ? { components } : {}),
        },
      });
    },
  };
}
