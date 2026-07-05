import "server-only";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/**
 * Dispara um novo e-mail de verificação para o usuário. Invalida tokens
 * anteriores não usados. Idempotente — pode ser chamado várias vezes.
 */
export async function sendVerificationFor(userId: string): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) return { ok: false };
  if (user.emailVerifiedAt) return { ok: true }; // já confirmado

  // Invalida tokens vivos anteriores.
  await prisma.emailVerifyToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { plain, hash } = generateToken();
  await prisma.emailVerifyToken.create({
    data: {
      userId,
      email: user.email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const res = await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token: plain,
  });
  if (!res.ok) {
    logger.error("Verificação de e-mail — falha no envio", { userId });
    return { ok: false };
  }
  return { ok: true };
}
