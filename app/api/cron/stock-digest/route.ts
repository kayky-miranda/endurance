import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getStockAlerts } from "@/lib/endurance/stock-alerts";
import { sendStockDigestEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diário: digest de estoque crítico por e-mail.
 *
 * Para cada organização com produtos, cruza estoque × velocidade de venda
 * (getStockAlerts) e, se houver itens ESGOTADOS ou CRÍTICOS (≤3 dias),
 * envia UM e-mail ao dono. O throttle é o próprio agendamento (1×/dia) e o
 * filtro (só níveis graves) — nada de spam por item.
 *
 * Schedule sugerido: 0 11 * * * (11:00 UTC = 08:00 BRT).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Só orgs que têm produtos (evita rodar alerta em espaços vazios).
  const orgs = await prisma.organization.findMany({
    where: { products: { some: {} } },
    select: { id: true, name: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const org of orgs) {
    try {
      const alerts = await getStockAlerts(org.id);
      const grave = alerts
        .filter((a) => a.level === "rompido" || a.level === "critico")
        .slice(0, 15); // e-mail legível; o app mostra a lista completa
      if (grave.length === 0) {
        skipped++;
        continue;
      }
      const owner = await prisma.user.findFirst({
        where: { organizationId: org.id, role: "OWNER" },
        select: { name: true, email: true },
      });
      if (!owner) {
        skipped++;
        continue;
      }
      await sendStockDigestEmail({
        to: owner.email,
        name: owner.name,
        orgName: org.name,
        items: grave.map((a) => ({
          name: a.name,
          stock: a.stock,
          daysLeft: a.daysLeft,
          level: a.level,
        })),
      });
      sent++;
    } catch (e) {
      logger.exception("Cron stock-digest — falha numa org", e);
    }
  }

  logger.info("Cron: stock-digest", { orgs: orgs.length, sent, skipped });
  return NextResponse.json({
    ok: true,
    orgs: orgs.length,
    sent,
    skipped,
    ranAt: new Date().toISOString(),
  });
}
