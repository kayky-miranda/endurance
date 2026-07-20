import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { money } from "@/lib/endurance/money";
import { sendFinanceDigestEmail, type FinanceDigestItem } from "@/lib/email";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diário: digest financeiro por e-mail — contas PENDENTES já vencidas ou
 * vencendo nos próximos 3 dias, por organização, enviado ao dono. Mesmo
 * racional do stock-digest: 1 e-mail/dia no máximo, e só quando há itens.
 *
 * Schedule: 30 11 * * * (11:30 UTC = 08:30 BRT).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 3);
  horizon.setHours(23, 59, 59, 999);

  // Uma query só: tudo que está pendente na janela, agrupável por org.
  const entries = await prisma.financialEntry.findMany({
    where: { status: "pendente", dueDate: { lte: horizon } },
    orderBy: { dueDate: "asc" },
    select: {
      organizationId: true,
      description: true,
      kind: true,
      amount: true,
      dueDate: true,
    },
  });
  const byOrg = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byOrg.get(e.organizationId) ?? [];
    list.push(e);
    byOrg.set(e.organizationId, list);
  }

  let sent = 0;
  let skipped = 0;
  for (const [orgId, list] of byOrg) {
    try {
      const owner = await prisma.user.findFirst({
        where: { organizationId: orgId, role: "OWNER", status: { not: "deleted" } },
        select: { name: true, email: true, organization: { select: { name: true } } },
      });
      if (!owner || owner.email.endsWith("@deleted.endurance.local")) {
        skipped++;
        continue;
      }
      const items: FinanceDigestItem[] = list.slice(0, 15).map((e) => ({
        description: e.description,
        kind: e.kind,
        amount: money(e.amount),
        dueDate: e.dueDate.toISOString().slice(0, 10),
        overdue: e.dueDate < now,
      }));
      const totalPagar = list
        .filter((e) => e.kind === "pagar")
        .reduce((s, e) => s + money(e.amount), 0);
      const totalReceber = list
        .filter((e) => e.kind === "receber")
        .reduce((s, e) => s + money(e.amount), 0);
      await sendFinanceDigestEmail({
        to: owner.email,
        name: owner.name,
        orgName: owner.organization?.name ?? "seu espaço",
        items,
        totalPagar,
        totalReceber,
      });
      sent++;
    } catch (e) {
      logger.exception("Cron finance-digest — falha em uma org", e, { orgId });
      skipped++;
    }
  }

  logger.info("Cron: finance-digest", { orgs: byOrg.size, sent, skipped });
  return NextResponse.json({ ok: true, sent, skipped, ranAt: now.toISOString() });
}
