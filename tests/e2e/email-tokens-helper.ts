import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

/**
 * Helper E2E para os fluxos baseados em token enviado por e-mail (verificação,
 * reset de senha, convite). Como o app guarda só o SHA-256 do token (o plain
 * vai no e-mail, que em teste cai no stub), o link real não é recuperável do
 * banco. Aqui cunhamos o token diretamente: geramos o plain, gravamos o hash
 * no mesmo formato de lib/tokens.ts e devolvemos o plain pro teste navegar.
 *
 * Isso exercita o lado de CONSUMO (validação single-use, UI e criação de
 * sessão) — a parte crítica de segurança — de forma determinística.
 */

let _prisma: PrismaClient | null = null;
function db(): PrismaClient {
  return (_prisma ??= new PrismaClient());
}

function mintToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

const HOUR = 60 * 60_000;

/** Cria um EmailVerifyToken válido para o usuário e devolve o token plain. */
export async function mintEmailVerifyToken(email: string): Promise<string> {
  const user = await db().user.findUniqueOrThrow({ where: { email } });
  const { plain, hash } = mintToken();
  await db().emailVerifyToken.create({
    data: {
      userId: user.id,
      email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
    },
  });
  return plain;
}

/** Cria um PasswordResetToken válido e devolve o token plain. */
export async function mintPasswordResetToken(email: string): Promise<string> {
  const user = await db().user.findUniqueOrThrow({ where: { email } });
  const { plain, hash } = mintToken();
  await db().passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + HOUR),
    },
  });
  return plain;
}

/** Cria um Invite válido (perfil operador_pdv) no org do slug e devolve o plain. */
export async function mintInviteToken(
  slug: string,
  inviteeEmail: string,
): Promise<string> {
  const org = await db().organization.findFirstOrThrow({ where: { slug } });
  const { plain, hash } = mintToken();
  await db().invite.create({
    data: {
      organizationId: org.id,
      email: inviteeEmail,
      role: "MEMBER",
      profile: "operador_pdv",
      permissions: [],
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
    },
  });
  return plain;
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const u = await db().user.findUnique({
    where: { email },
    select: { emailVerifiedAt: true },
  });
  return Boolean(u?.emailVerifiedAt);
}

export async function disconnectTokens(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
