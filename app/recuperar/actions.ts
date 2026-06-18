"use server";

import { prisma } from "@/lib/db";
import { hit, clientIp } from "@/lib/rate-limit";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Solicita o link de recuperação. Por privacidade, NÃO informa se o e-mail
 * existe — devolve `{ok:true}` em qualquer caso para não permitir enumeração.
 */
export async function requestPasswordResetAction(emailRaw: string): Promise<Result> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe seu e-mail." };

  // Rate limit por IP — força bruta de enumeração também é abuso.
  if (!hit(`reset:ip:${await clientIp()}`, 5, 10 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Invalida tokens anteriores não usados (defesa em profundidade).
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const { plain, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hora
      },
    });

    const res = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: plain,
    });
    if (!res.ok) {
      logger.error("Reset de senha — falha no envio do e-mail", { userId: user.id });
      return { ok: false, error: "Não consegui enviar o e-mail. Tente em alguns minutos." };
    }
  } else {
    // Pequeno atraso para igualar tempo de resposta (evita timing attack).
    await new Promise((r) => setTimeout(r, 200));
  }

  return { ok: true };
}

/**
 * Aplica a nova senha. Token é resolvido pelo hash, single-use, expira em 1h.
 */
export async function resetPasswordAction(
  tokenPlain: string,
  newPassword: string,
): Promise<Result> {
  if (!tokenPlain) return { ok: false, error: "Link inválido." };
  if (newPassword.length < 8)
    return { ok: false, error: "A senha precisa ter ao menos 8 caracteres." };
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword))
    return { ok: false, error: "Use letras e números na senha." };
  if (newPassword.length > 128)
    return { ok: false, error: "Senha muito longa." };

  if (!hit(`reset:apply:${await clientIp()}`, 10, 10 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const tokenHash = hashToken(tokenPlain);
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!token || token.usedAt || token.expiresAt < new Date())
    return { ok: false, error: "Link expirado ou já usado. Solicite outro." };

  const passwordHash = await hashPassword(newPassword);

  // Atomicidade: marca token como usado E atualiza a senha numa transação.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    // Invalida outros tokens vivos do mesmo usuário (defesa: se o atacante
    // pediu reset e a vítima também, a vítima trocou — invalida o do atacante).
    prisma.passwordResetToken.updateMany({
      where: { userId: token.userId, usedAt: null, id: { not: token.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
