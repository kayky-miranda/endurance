import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron semanal: limpa dados transitórios que já cumpriram propósito.
 *
 *  - PasswordResetToken expirados há mais de 30 dias.
 *  - EmailVerifyToken expirados há mais de 30 dias.
 *
 * Tokens válidos (não expirados ou usados recentemente) ficam — auditoria.
 *
 * Schedule sugerido: 0 3 * * 0 (Dom 03:00 UTC = Sáb 24:00 BRT).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);

  const [reset, verify] = await Promise.all([
    prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    }),
    prisma.emailVerifyToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    }),
  ]);

  logger.info("Cron: housekeeping", {
    passwordResetTokens: reset.count,
    emailVerifyTokens: verify.count,
  });
  return NextResponse.json({
    ok: true,
    passwordResetTokens: reset.count,
    emailVerifyTokens: verify.count,
    ranAt: new Date().toISOString(),
  });
}
