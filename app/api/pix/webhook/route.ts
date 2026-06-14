import { getChargeByProviderRef, refreshCharge } from "@/lib/endurance/pix-service";

export const runtime = "nodejs";

/**
 * Webhook de cobrança PIX (Mercado Pago). É apenas um GATILHO: nunca confiamos
 * no status do payload — localizamos a cobrança pelo id do PSP e RECONSULTAMOS
 * o provedor (status autoritativo) via `refreshCharge`, que persiste a transição
 * para `pago`/`expirado`. A finalização da venda continua no PDV (o webhook não
 * tem o carrinho); uma cobrança paga sem venda vira sinal de conciliação.
 *
 * Notificações do MP chegam como `?type=payment&data.id=123` (e/ou no corpo).
 */
export async function POST(req: Request): Promise<Response> {
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

    const charge = await getChargeByProviderRef(paymentId);
    if (!charge) return Response.json({ ok: true, ignored: "cobrança ausente" });

    await refreshCharge(charge);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api:pix:webhook]", e);
    // 200 mesmo em erro: o PSP reentrega; e o PDV concilia por polling.
    return Response.json({ ok: false }, { status: 200 });
  }
}
