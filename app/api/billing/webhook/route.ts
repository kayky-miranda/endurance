import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hit, clientIp } from "@/lib/rate-limit";
import { sendPaymentOverdueEmail } from "@/lib/email";
import { applyGatewayEvent } from "@/lib/endurance/billing-service";
import {
  verifyAsaasWebhook,
  mapAsaasEvent,
} from "@/lib/endurance/billing-providers/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do gateway de cobrança (Asaas). Mantém o status da assinatura
 * sincronizado com os eventos de pagamento. A org é resolvida pelo
 * `externalReference` (= organizationId) que enviamos ao criar a assinatura.
 */
export async function POST(request: Request) {
  const ip = await clientIp();
  if (!(await hit(`webhook:billing:${ip}`, 120, 60_000)).ok) {
    logger.warn("Webhook billing rate-limited", { ip });
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const verify = verifyAsaasWebhook(request.headers.get("asaas-access-token"));
  if (!verify.ok) {
    logger.warn("Webhook billing — token inválido");
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    event?: string;
    payment?: { externalReference?: string };
    subscription?: { externalReference?: string };
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const event = String(body?.event ?? "");
  const orgId = String(
    body?.payment?.externalReference ?? body?.subscription?.externalReference ?? "",
  );
  const status = mapAsaasEvent(event);

  if (status && orgId) {
    // Toda a decisão (promover pendingPlan, renovar ciclo, inadimplência)
    // vive no serviço — o webhook só valida, traduz o evento e delega.
    const result = await applyGatewayEvent(orgId, status);
    logger.info("Webhook billing aplicado", {
      event,
      orgId,
      status,
      rows: result.rows,
      activatedPlan: result.activatedPlan,
      verified: verify.verified,
    });

    // Dunning: cobrança atrasada → avisa o dono por e-mail (best-effort;
    // falha de e-mail não pode falhar o webhook, senão o gateway reentrega).
    if (result.becamePastDue) {
      try {
        const [owner, org] = await Promise.all([
          prisma.user.findFirst({
            where: { organizationId: orgId, role: "OWNER" },
            select: { name: true, email: true },
          }),
          prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true },
          }),
        ]);
        if (owner)
          await sendPaymentOverdueEmail({
            to: owner.email,
            name: owner.name,
            orgName: org?.name ?? "seu espaço",
          });
      } catch (e) {
        logger.exception("Dunning — falha ao enviar e-mail de atraso", e);
      }
    }
  } else {
    logger.info("Webhook billing sem ação", { event, hasOrg: Boolean(orgId) });
  }

  // O Asaas reentrega se não receber 200.
  return Response.json({ ok: true });
}
