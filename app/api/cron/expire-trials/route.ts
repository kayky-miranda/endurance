import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diário: move Subscriptions com trial expirado para `past_due`.
 *
 * Por que `past_due` em vez de `canceled`?
 *  - past_due é o estado "tem que regularizar"; ainda permite o usuário
 *    abrir o app, ver dados, fazer upgrade. canceled é encerramento.
 *  - O gate `assertSubscriptionActive` já bloqueia mutações sensíveis em
 *    past_due — então o efeito comercial é o mesmo.
 *
 * Schedule sugerido: 0 4 * * * (04:00 UTC = 01:00 BRT).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const now = new Date();
  const expired = await prisma.subscription.updateMany({
    where: {
      status: "trialing",
      trialEndsAt: { lt: now },
    },
    data: { status: "past_due" },
  });

  logger.info("Cron: expire-trials", { expired: expired.count });
  return NextResponse.json({ ok: true, expired: expired.count, ranAt: now.toISOString() });
}
