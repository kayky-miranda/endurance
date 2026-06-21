"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  requirePermission,
  type Role,
} from "@/lib/auth";
import { createWorkspace, EmailTakenError } from "@/lib/endurance/workspace";
import { allPermissionIds } from "@/lib/endurance/permissions";
import { hit, peek, record, clientIp } from "@/lib/rate-limit";
import { sendVerificationFor } from "@/lib/endurance/email-verification";
import { logger } from "@/lib/logger";
import { SignupSchema, firstError } from "@/lib/validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Política de senha: ≥8 caracteres, com pelo menos uma letra e um número.
 * Para ser amigável no cadastro de balcão (mercados/salões), não exigimos
 * símbolos especiais — exigência mínima para passar em check de invasão de
 * dicionário.
 */
function validatePassword(pw: string): { ok: true } | { ok: false; error: string } {
  if (pw.length < 8) return { ok: false, error: "A senha precisa ter ao menos 8 caracteres." };
  if (pw.length > 128) return { ok: false, error: "Senha muito longa (limite 128 caracteres)." };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, error: "A senha precisa ter ao menos uma letra." };
  if (!/[0-9]/.test(pw)) return { ok: false, error: "A senha precisa ter ao menos um número." };
  return { ok: true };
}

type AuthResult =
  | { ok: true; slug: string }
  | { ok: true; needs2fa: true } // senha OK mas falta TOTP
  | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

const PENDING_2FA_COOKIE = "endurance_pending_2fa";
const PENDING_2FA_TTL_SEC = 5 * 60;

export interface SignupInput {
  name: string; // nome do negócio
  niche: string;
  city?: string;
  state?: string;
  country?: string;
  segment?: string;
  moduleIds: string[];
  ownerName: string;
  email: string;
  password: string;
}

/** Cria o espaço + o usuário dono e já abre a sessão. */
export async function signupAction(input: SignupInput): Promise<AuthResult> {
  // Rate limit por IP: cadastro é caro (cria org + usuário) e alvo de bots.
  const rl = hit(`signup:${await clientIp()}`, 5, 10 * 60_000);
  if (!rl.ok)
    return {
      ok: false,
      error: "Muitas tentativas de cadastro. Tente novamente em alguns minutos.",
    };

  // Validação centralizada — Zod cobre formato, comprimento e política de senha.
  const parsed = SignupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;
  const { ownerName, email, password } = data;

  try {
    const passwordHash = await hashPassword(password);
    const { slug, userId, orgId } = await createWorkspace({
      name: data.name,
      niche: data.niche,
      city: data.city,
      state: data.state,
      country: data.country,
      segment: data.segment,
      moduleIds: data.moduleIds,
      owner: { name: ownerName, email, passwordHash },
    });
    await createSession({
      sub: userId,
      name: ownerName,
      email,
      role: "OWNER",
      org: orgId,
      slug,
      profile: "administrador",
      permissions: allPermissionIds(),
    });
    // Dispara verificação de e-mail em background — se falhar, o usuário pode
    // re-solicitar via banner. Não bloqueia o signup.
    sendVerificationFor(userId).catch((e) =>
      logger.exception("Falha ao disparar verificação no signup", e),
    );
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof EmailTakenError)
      return { ok: false, error: "Esse e-mail já tem conta — faça login." };
    logger.exception("Signup falhou", e);
    return { ok: false, error: "Não consegui criar a conta." };
  }
}

/**
 * Reenvia o e-mail de verificação para o usuário logado. Acionada pelo banner
 * do dashboard quando emailVerifiedAt está null.
 */
export async function resendVerificationAction(): Promise<SimpleResult> {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  // Rate limit: 3 reenvios por usuário a cada 10 min.
  if (!hit(`verify:resend:${session.sub}`, 3, 10 * 60_000).ok)
    return { ok: false, error: "Aguarde alguns minutos antes de reenviar." };

  const res = await sendVerificationFor(session.sub);
  if (!res.ok) return { ok: false, error: "Não consegui enviar o e-mail. Tente em alguns minutos." };
  return { ok: true };
}

export async function loginAction(
  emailRaw: string,
  password: string,
): Promise<AuthResult> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email || !password)
    return { ok: false, error: "Informe e-mail e senha." };

  // Rate limit: por IP (rajada geral) e por e-mail (força bruta de senha —
  // conta só tentativas FALHAS, então errar pouco não bloqueia ninguém).
  if (!hit(`login:ip:${await clientIp()}`, 20, 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde um instante." };
  const failKey = `login:fail:${email}`;
  const lock = peek(failKey, 5);
  if (!lock.ok)
    return {
      ok: false,
      error: `Muitas tentativas para este e-mail. Aguarde ${Math.max(
        1,
        Math.ceil(lock.retryAfterSec / 60),
      )} min.`,
    };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    record(failKey, 15 * 60_000);
    return { ok: false, error: "E-mail ou senha inválidos." };
  }

  if (user.status === "blocked")
    return {
      ok: false,
      error: "Usuário bloqueado. Fale com o administrador do espaço.",
    };

  // Se o usuário tem 2FA ativo, NÃO criamos a sessão ainda. Marcamos um
  // cookie "pending" com o id do usuário e devolvemos needs2fa pro client
  // prompt do código. verifyTotpLoginAction abaixo finaliza o login.
  if (user.totpEnabledAt && user.totpSecret) {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set(PENDING_2FA_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_2FA_TTL_SEC,
    });
    return { ok: true, needs2fa: true };
  }

  // Registra o último acesso (auditoria / coluna "Último acesso").
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    org: user.organizationId,
    slug: user.organization.slug,
    profile: user.profile,
    permissions: user.permissions,
  });
  return { ok: true, slug: user.organization.slug };
}

/**
 * Verifica o código TOTP do login em 2 etapas. Lê o cookie pending_2fa
 * (gravado em loginAction quando o usuário tem 2FA ativo), confere o código
 * e só então cria a sessão real.
 */
export async function verifyTotpLoginAction(code: string): Promise<AuthResult> {
  const { cookies } = await import("next/headers");
  const { verifyTotpCode } = await import("@/lib/totp");
  const store = await cookies();
  const userId = store.get(PENDING_2FA_COOKIE)?.value;
  if (!userId) return { ok: false, error: "Sessão de login expirou — refaça o login." };

  // Rate limit por usuário (brute-force de TOTP).
  if (!hit(`2fa:login:${userId}`, 5, 5 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user || !user.totpSecret || !user.totpEnabledAt)
    return { ok: false, error: "Configuração de 2FA inválida." };
  if (user.status === "blocked")
    return { ok: false, error: "Usuário bloqueado." };

  if (!verifyTotpCode(user.totpSecret, code))
    return { ok: false, error: "Código incorreto." };

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    org: user.organizationId,
    slug: user.organization.slug,
    profile: user.profile,
    permissions: user.permissions,
  });

  store.delete(PENDING_2FA_COOKIE);
  return { ok: true, slug: user.organization.slug };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}

export interface AddMemberInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

/** Adiciona um membro à organização do usuário logado (gated OWNER/ADMIN). */
export async function addMemberAction(
  input: AddMemberInput,
): Promise<SimpleResult> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";
  // Membros adicionados nunca são OWNER (só o criador é).
  const role: Role = input.role === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!name) return { ok: false, error: "Informe o nome." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
  if (password.length < 6)
    return { ok: false, error: "Senha de ao menos 6 caracteres." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "E-mail já cadastrado." };

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, passwordHash, role, organizationId: session.org },
  });
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<SimpleResult> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;
  if (userId === session.sub)
    return { ok: false, error: "Você não pode remover a si mesmo." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== session.org)
    return { ok: false, error: "Usuário não encontrado." };
  if (target.role === "OWNER")
    return { ok: false, error: "Não é possível remover o dono." };

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}
