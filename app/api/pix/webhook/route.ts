import { getChargeByProviderRef, refreshCharge } from "@/lib/endurance/pix-service";
import { verifyMercadoPagoSignature } from "@/lib/webhook-signature";
import { hit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Webhook de cobrança PIX (Mercado Pago). É apenas um GATILHO: nunca confiamos
 * no status do payload — localizamos a cobrança pelo id do PSP e RECONSULTAMOS
 * o provedor (status autoritativo) via `refreshCharge`, que persiste a transição
 * para `pago`/`expirado`. A finalização da venda continua no PDV (o webhook não
 * tem o carrinho); uma cobrança paga sem venda vira sinal de conciliação.
 *
 * Validação de assinatura (HMAC do Mercado Pago) é obrigatória em produção —
 * em sandbox/dev sem MERCADO_PAGO_WEBHOOK_SECRET o evento segue, mas o log
 * marca `verified: false`.
 *
 * Notificações do MP chegam como `?type=payment&data.id=123` (e/ou no corpo).
 */
export async function POST(req: Request): Promise<Response> {
  // Rate limit por IP — webhook é endpoint público.
  const ip = await clientIp();
  if (!hit(`webhook:pix:${ip}`, 120, 60_000).ok) {
    logger.warn("PIX webhook rate-limited", { ip });
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    let paymentId =
      url.searchParams.get("data.id") || url.searchParams.get("id") || "";
    let topic =
      url.searchParams.get("type") || url.searchParams.get("topic") || "";

    if (!paymentId) {
      try {
        const body = (await req.json()) as {
          type?: string;
          action?: string;
          data?: { id?: string | number };
        };
        topic = topic || body.type || body.action || "";
        if (body.data?.id != null) paymentId = String(body.data.id);
      } catch {
        // corpo vazio/ inválido — segue com os query params
      }
    }

    // Ignora eventos que não são de pagamento (merchant_order, etc.).
    if (topic && !topic.includes("payment"))
      return Response.json({ ok: true, ignored: topic });
    if (!paymentId) return Response.json({ ok: true, ignored: "sem id" });

    // Valida HMAC do Mercado Pago antes de tocar no banco.
    const sig = verifyMercadoPagoSignature(req, paymentId);
    if (!sig.ok) {
      logger.warn("PIX webhook assinatura inválida", { reason: sig.reason, paymentId });
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    const charge = await getChargeByProviderRef(paymentId);
    if (!charge) return Response.json({ ok: true, ignored: "cobrança ausente" });

    await refreshCharge(charge);
    logger.info("PIX webhook processado", { paymentId, verified: sig.verified });
    return Response.json({ ok: true });
  } catch (e) {
    logger.exception("PIX webhook erro", e);
    // 200 mesmo em erro: o PSP reentrega; e o PDV concilia por polling.
    return Response.json({ ok: false }, { status: 200 });
  }
}
