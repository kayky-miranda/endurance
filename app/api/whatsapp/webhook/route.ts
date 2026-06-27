import { updateMessageStatusByRef } from "@/lib/endurance/whatsapp-service";
import { verifyMetaSignature } from "@/lib/webhook-signature";
import { hit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Webhook do WhatsApp Business (Meta Cloud API).
 *  - GET: verificação do endpoint (hub.challenge) com WHATSAPP_VERIFY_TOKEN.
 *  - POST: atualizações de status de entrega (sent/delivered/read/failed) →
 *    atualiza o status da `WhatsAppMessage` pelo id do provedor (wamid).
 *
 * Assinatura HMAC do header `x-hub-signature-256` é validada com META_APP_SECRET.
 * Em dev/sandbox sem o segredo o evento segue, mas o log marca não verificado.
 *
 * Sem inbound/chatbot — só status de entrega.
 */

const STATUS_MAP: Record<string, string> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falha",
};

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge)
    return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

interface MetaStatusWebhook {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{ id?: string; status?: string }>;
      };
    }>;
  }>;
}

export async function POST(req: Request): Promise<Response> {
  // Rate limit por IP.
  const ip = await clientIp();
  if (!(await hit(`webhook:wa:${ip}`, 120, 60_000)).ok) {
    logger.warn("WhatsApp webhook rate-limited", { ip });
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // Lê o corpo bruto (precisamos pra validar HMAC antes de parse).
  const raw = await req.text();
  const sig = verifyMetaSignature(req.headers.get("x-hub-signature-256"), raw);
  if (!sig.ok) {
    logger.warn("WhatsApp webhook assinatura inválida", { reason: sig.reason });
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(raw) as MetaStatusWebhook;
    const statuses =
      body.entry?.flatMap(
        (e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? [],
      ) ?? [];
    for (const s of statuses) {
      const mapped = s.status ? STATUS_MAP[s.status] : undefined;
      if (s.id && mapped) await updateMessageStatusByRef(s.id, mapped);
    }
    logger.info("WhatsApp webhook processado", { count: statuses.length, verified: sig.verified });
    return Response.json({ ok: true });
  } catch (e) {
    logger.exception("WhatsApp webhook erro", e);
    return Response.json({ ok: false }, { status: 200 });
  }
}
