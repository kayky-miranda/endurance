"use server";

import { redirect } from "next/navigation";
import { getSession, destroySession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Exclusão de conta (LGPD art. 18, VI). Regras:
 *
 *  - O OWNER NÃO pode auto-excluir enquanto for o único responsável da
 *    organização — primeiro precisa transferir a titularidade ou encerrar a
 *    organização inteira. Evita órfãos de cobrança e dados fiscais.
 *  - Para MEMBERs/ADMINs, fazemos ANONIMIZAÇÃO em vez de DELETE: trocamos
 *    nome/email/telefone por placeholders e marcamos `status='deleted'`.
 *    Dados fiscais (Sale, FiscalDocument) NÃO podem ser apagados (retenção
 *    legal de 5 anos), mas a referência ao usuário passa a ser anônima.
 *  - Confirmação por senha + digitação literal "EXCLUIR MINHA CONTA".
 */
export async function deleteAccountAction(input: {
  password: string;
  confirmation: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  // Anti-brute force: 3 tentativas por usuário em 1h.
  if (!hit(`acct:delete:${session.sub}`, 3, 60 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde uma hora." };

  if (input.confirmation.trim() !== "EXCLUIR MINHA CONTA")
    return { ok: false, error: "Confirmação não confere — digite exatamente: EXCLUIR MINHA CONTA" };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, passwordHash: true, role: true, organizationId: true, email: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) return { ok: false, error: "Senha incorreta." };

  // Trava do OWNER: precisa haver outro OWNER OU a org só ter ele.
  if (user.role === "OWNER") {
    const otherOwners = await prisma.user.count({
      where: {
        organizationId: user.organizationId,
        role: "OWNER",
        id: { not: user.id },
        status: { not: "deleted" },
      },
    });
    const otherUsers = await prisma.user.count({
      where: {
        organizationId: user.organizationId,
        id: { not: user.id },
        status: { not: "deleted" },
      },
    });
    if (otherOwners === 0 && otherUsers > 0)
      return {
        ok: false,
        error: "Você é o único responsável (OWNER). Promova outro usuário a OWNER ou encerre a organização antes.",
      };
  }

  // Anonimização atômica.
  const anonId = `deleted-${user.id.slice(-8)}`;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: "Usuário excluído",
        email: `${anonId}@deleted.endurance.local`,
        phone: "",
        jobTitle: "",
        passwordHash: "DELETED",
        status: "deleted",
        permissions: [],
        emailVerifiedAt: null,
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerifyToken.deleteMany({ where: { userId: user.id } }),
  ]);

  logger.info("Conta excluída (LGPD)", { userId: user.id, role: user.role });

  await destroySession();
  return { ok: true };
}

/**
 * Server-side redirect helper para a tela de "conta excluída".
 */
export async function postDeleteRedirect(): Promise<never> {
  redirect("/?acct=deleted");
}
