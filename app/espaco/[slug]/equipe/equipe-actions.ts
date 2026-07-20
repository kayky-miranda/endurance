"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  hashPassword,
  type SessionPayload,
} from "@/lib/auth";
import {
  profileById,
  sanitizePermissions,
  permissionsForProfile,
  type Role,
} from "@/lib/endurance/permissions";
import { logActivity } from "@/lib/endurance/activity-log";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type R = { ok: true } | { ok: false; error: string };

/**
 * Resolve papel-base + permissões a partir do perfil escolhido e da lista
 * granular. Se houver perfil pré-configurado, ele define o papel-base; as
 * permissões enviadas (já customizadas na UI) são sanitizadas contra o catálogo.
 */
function resolveAccess(
  profileId: string,
  permissions: string[],
): { role: Role; profile: string; permissions: string[] } {
  const profile = profileById(profileId);
  const perms = sanitizePermissions(
    permissions.length ? permissions : permissionsForProfile(profileId),
  );
  return {
    role: profile ? profile.baseRole : "MEMBER",
    profile: profile ? profile.id : "",
    permissions: perms,
  };
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  password: string;
  profile: string;
  permissions: string[];
}

export async function createUserAction(input: CreateUserInput): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  // Gate de assinatura: past_due / canceled / trial expirado bloqueiam mutação.
  const { assertSubscriptionActive, checkSeatAvailability } = await import(
    "@/lib/endurance/plan-limits"
  );
  const sub = await assertSubscriptionActive(session.org);
  if (!sub.ok) return { ok: false, error: sub.error! };

  // Gate de seats: cada plano tem o seu limite (0 = ilimitado).
  const seat = await checkSeatAvailability(session.org);
  if (!seat.ok) return { ok: false, error: seat.error! };

  // Validação centralizada via Zod (formato, comprimento, política de senha).
  const { CreateUserSchema, firstError } = await import("@/lib/validation");
  const parsed = CreateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "E-mail já cadastrado." };

  const access = resolveAccess(input.profile, input.permissions);
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: (input.phone ?? "").trim().slice(0, 20),
      jobTitle: (input.jobTitle ?? "").trim().slice(0, 60),
      passwordHash,
      role: access.role,
      profile: access.profile,
      permissions: access.permissions,
      status: "active",
      organizationId: session.org,
    },
  });

  await logActivity(
    session,
    "user.create",
    `Criou o usuário ${name} (${email})`,
    user.id,
  );
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

/** Carrega o alvo garantindo que pertence à organização do solicitante. */
async function loadTarget(session: SessionPayload, userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== session.org) return null;
  return target;
}

export interface UpdateUserInput {
  userId: string;
  phone?: string;
  jobTitle?: string;
  profile: string;
  permissions: string[];
}

export async function updateUserAction(input: UpdateUserInput): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  const target = await loadTarget(session, input.userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.role === "OWNER")
    return {
      ok: false,
      error: "O dono do espaço tem acesso total e não pode ser limitado.",
    };

  const access = resolveAccess(input.profile, input.permissions);
  await prisma.user.update({
    where: { id: target.id },
    data: {
      phone: (input.phone ?? target.phone).trim().slice(0, 20),
      jobTitle: (input.jobTitle ?? target.jobTitle).trim().slice(0, 60),
      role: access.role,
      profile: access.profile,
      permissions: access.permissions,
    },
  });

  await logActivity(
    session,
    "user.update",
    `Atualizou permissões de ${target.name}`,
    target.id,
  );
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

export async function setUserStatusAction(
  userId: string,
  status: "active" | "blocked",
): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;
  if (userId === session.sub)
    return { ok: false, error: "Você não pode bloquear a si mesmo." };

  const target = await loadTarget(session, userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.role === "OWNER")
    return { ok: false, error: "Não é possível bloquear o dono do espaço." };

  const next = status === "blocked" ? "blocked" : "active";
  await prisma.user.update({
    where: { id: target.id },
    data: { status: next },
  });

  await logActivity(
    session,
    next === "blocked" ? "user.block" : "user.unblock",
    `${next === "blocked" ? "Bloqueou" : "Desbloqueou"} ${target.name}`,
    target.id,
  );
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string,
): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  const password = newPassword ?? "";
  if (password.length < 6)
    return { ok: false, error: "A senha precisa ter ao menos 6 caracteres." };

  const target = await loadTarget(session, userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  // Apenas o próprio dono pode redefinir a senha do dono.
  if (target.role === "OWNER" && target.id !== session.sub)
    return { ok: false, error: "Não é possível redefinir a senha do dono." };

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash },
  });

  await logActivity(
    session,
    "user.reset_password",
    `Redefiniu a senha de ${target.name}`,
    target.id,
  );
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

export async function removeUserAction(userId: string): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;
  if (userId === session.sub)
    return { ok: false, error: "Você não pode remover a si mesmo." };

  const target = await loadTarget(session, userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.role === "OWNER")
    return { ok: false, error: "Não é possível remover o dono do espaço." };

  // Exclusão LÓGICA: mantém o nome no histórico (vendas, caixa, auditoria),
  // bloqueia o login e libera o e-mail para um novo convite.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        email: `deleted-${target.id.slice(-8)}@deleted.endurance.local`,
        passwordHash: "DELETED",
        status: "deleted",
        permissions: [],
        emailVerifiedAt: null,
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: target.id } }),
    prisma.emailVerifyToken.deleteMany({ where: { userId: target.id } }),
  ]);
  await logActivity(
    session,
    "user.delete",
    `Removeu o usuário ${target.name} (${target.email})`,
    target.id,
  );
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}
