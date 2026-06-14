import { updateMessageStatusByRef } from "@/lib/endurance/whatsapp-service";

export const runtime = "nodejs";

/**
 * Webhook do WhatsApp Business (Meta Cloud API).
 *  - GET: verificação do endpoint (hub.challenge) com WHATSAPP_VERIFY_TOKEN.
 *  - POST: atualizações de status de entrega (sent/delivered/read/failed) →
 *    atualiza o status da `WhatsAppMessage` pelo id do provedor (wamid).
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
  try {
    const body = (await req.json()) as MetaStatusWebhook;
    const statuses =
      body.entry?.flatMap(
        (e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? [],
      ) ?? [];
    for (const s of statuses) {
      const mapped = s.status ? STATUS_MAP[s.status] : undefined;
      if (s.id && mapped) await updateMessageStatusByRef(s.id, mapped);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api:whatsapp:webhook]", e);
    return Response.json({ ok: false }, { status: 200 });
  }
}
