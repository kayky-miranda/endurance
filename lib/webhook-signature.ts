import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";

/**
 * Validação de assinatura HMAC dos webhooks de provedores externos.
 *
 * Sem isso, qualquer um pode chamar /api/pix/webhook e marcar uma cobrança
 * como paga, ou /api/whatsapp/webhook e poluir o histórico.
 *
 * Em dev/sandbox, se o segredo não estiver definido, a validação retorna
 * `ok: true` com `verified: false` — o webhook segue funcionando para testes,
 * mas o `verified` viaja no log.
 */

export interface VerifyResult {
  ok: boolean;
  verified: boolean;
  reason?: string;
}

function safeEq(a: string, b: string): boolean {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length === 0 || A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

/**
 * Mercado Pago x-signature (formato `ts=...,v1=hmac`).
 *
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * HMAC-SHA256 com MERCADO_PAGO_WEBHOOK_SECRET (cadastrado no painel do MP).
 *
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoSignature(
  req: Request,
  dataId: string,
): VerifyResult {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("PIX webhook sem MERCADO_PAGO_WEBHOOK_SECRET — assinatura não verificada");
    return { ok: true, verified: false, reason: "secret-missing" };
  }

  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!signatureHeader) return { ok: false, verified: false, reason: "no-signature" };
  if (!requestId) return { ok: false, verified: false, reason: "no-request-id" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.trim().split("=");
      return [k, v];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, verified: false, reason: "malformed-signature" };

  // Janela anti-replay: 10 minutos.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, verified: false, reason: "bad-ts" };
  if (Math.abs(Date.now() - tsNum) > 10 * 60_000)
    return { ok: false, verified: false, reason: "expired" };

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeEq(expected, v1))
    return { ok: false, verified: false, reason: "mismatch" };

  return { ok: true, verified: true };
}

/**
 * Meta Cloud API (WhatsApp) — header `x-hub-signature-256: sha256=<hex>`.
 * HMAC-SHA256 do body bruto com META_APP_SECRET (App Secret do Facebook App).
 *
 * Referência: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export function verifyMetaSignature(
  signatureHeader: string | null,
  rawBody: string,
): VerifyResult {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    logger.warn("WhatsApp webhook sem META_APP_SECRET — assinatura não verificada");
    return { ok: true, verified: false, reason: "secret-missing" };
  }

  if (!signatureHeader) return { ok: false, verified: false, reason: "no-signature" };
  const m = signatureHeader.match(/^sha256=([0-9a-f]+)$/i);
  if (!m) return { ok: false, verified: false, reason: "malformed-signature" };

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!safeEq(expected, m[1].toLowerCase()))
    return { ok: false, verified: false, reason: "mismatch" };

  return { ok: true, verified: true };
}
