"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSession,
  hashPassword,
  verifyPassword,
  canManageTeam,
  type Role,
} from "@/lib/auth";
import { createWorkspace, EmailTakenError } from "@/lib/endurance/workspace";
import { allPermissionIds } from "@/lib/endurance/permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthResult = { ok: true; slug: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

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
  const ownerName = (input.ownerName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (!ownerName) return { ok: false, error: "Informe o seu nome." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
  if (password.length < 6)
    return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };

  try {
    const passwordHash = await hashPassword(password);
    const { slug, userId, orgId } = await createWorkspace({
      name: input.name,
      niche: input.niche,
      city: input.city,
      state: input.state,
      country: input.country,
      segment: input.segment,
      moduleIds: input.moduleIds,
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
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof EmailTakenError)
      return { ok: false, error: "Esse e-mail já tem conta — faça login." };
    console.error("[signup] erro:", e);
    return { ok: false, error: "Não consegui criar a conta." };
  }
}

export async function loginAction(
  emailRaw: string,
  password: string,
): Promise<AuthResult> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email || !password)
    return { ok: false, error: "Informe e-mail e senha." };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { ok: false, error: "E-mail ou senha inválidos." };

  if (user.status === "blocked")
    return {
      ok: false,
      error: "Usuário bloqueado. Fale com o administrador do espaço.",
    };

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
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(session.role))
    return { ok: false, error: "Você não tem permissão para isso." };

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
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(session.role))
    return { ok: false, error: "Você não tem permissão para isso." };
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
