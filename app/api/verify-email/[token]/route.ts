import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Confirma o e-mail via link enviado por e-mail. Single-use, redireciona para
 * /entrar com flag de sucesso (ou /verificar-email?erro=... se inválido).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) redirect("/entrar?verify=missing");

  const tokenHash = hashToken(token);
  const found = await prisma.emailVerifyToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, email: true, usedAt: true, expiresAt: true },
  });

  if (!found) redirect("/entrar?verify=invalid");
  if (found.usedAt) redirect("/entrar?verify=used");
  if (found.expiresAt < new Date()) redirect("/entrar?verify=expired");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: found.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerifyToken.update({
      where: { id: found.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logger.info("E-mail verificado", { userId: found.userId });
  redirect("/entrar?verify=ok");
}
