"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, hashPassword, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendTeamInviteEmail } from "@/lib/email";
import {
  profileById,
  permissionsForProfile,
  sanitizePermissions,
  type PermissionId,
} from "@/lib/endurance/permissions";
import type { Role } from "@/lib/auth";

/** Mesmo helper de equipe-actions: deriva role/profile/permissões definitivos. */
function resolveAccess(
  profileId: string,
  permissions: string[] | undefined,
): { role: Role; profile: string; permissions: PermissionId[] } {
  const profile = profileById(profileId);
  const perms = sanitizePermissions(
    permissions && permissions.length > 0
      ? permissions
      : permissionsForProfile(profileId),
  );
  return {
    role: (profile?.baseRole ?? "MEMBER") as Role,
    profile: profile?.id ?? "",
    permissions: perms,
  };
}
import { assertSubscriptionActive, checkSeatAvailability } from "@/lib/endurance/plan-limits";
import { logActivity } from "@/lib/endurance/activity-log";
import { hit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  CreateInviteSchema,
  AcceptInviteSchema,
  firstError,
} from "@/lib/validation";

type Result = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateInviteInput {
  email: string;
  profile: string; // perfil pré-configurado
  permissions?: string[];
}

/**
 * Cria um convite e envia o link mágico por e-mail. Não cria User — o cadastro
 * só acontece no aceite, em /convite/[token].
 */
export async function createInviteAction(input: CreateInviteInput): Promise<Result> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  if (!(await hit(`invite:${session.org}`, 30, 60 * 60_000)).ok)
    return { ok: false, error: "Muitos convites em pouco tempo. Aguarde uma hora." };

  // Gates de assinatura e seats.
  const sub = await assertSubscriptionActive(session.org);
  if (!sub.ok) return { ok: false, error: sub.error! };
  const seat = await checkSeatAvailability(session.org);
  if (!seat.ok) return { ok: false, error: seat.error! };

  const parsed = CreateInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Esse e-mail já tem conta." };

  // Cancela convites vivos anteriores pro mesmo e-mail nesta org.
  await prisma.invite.updateMany({
    where: { organizationId: session.org, email, acceptedAt: null },
    data: { acceptedAt: new Date() }, // marcar como "consumido" pra invalidar
  });

  const access = resolveAccess(input.profile, input.permissions);
  const { plain, hash } = generateToken();
  const invite = await prisma.invite.create({
    data: {
      organizationId: session.org,
      email,
      role: access.role,
      profile: access.profile,
      permissions: access.permissions,
      tokenHash: hash,
      invitedById: session.sub,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const org = await prisma.organization.findUnique({
    where: { id: session.org },
    select: { name: true },
  });
  const res = await sendTeamInviteEmail({
    to: email,
    orgName: org?.name ?? "ENDURANCE",
    inviterName: session.name,
    token: plain,
  });
  if (!res.ok) {
    logger.error("Convite — falha no envio", { inviteId: invite.id });
    return { ok: false, error: "Não consegui enviar o e-mail. Tente em alguns minutos." };
  }

  await logActivity(session, "invite.create", `Convidou ${email}`, invite.id);
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

/**
 * Cancela um convite ainda não aceito (vira "consumido"). O OWNER/ADMIN pode
 * fazer isso quando errou o e-mail ou desistiu da contratação.
 */
export async function cancelInviteAction(inviteId: string): Promise<Result> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== session.org)
    return { ok: false, error: "Convite não encontrado." };
  if (invite.acceptedAt)
    return { ok: false, error: "Convite já foi usado." };

  await prisma.invite.update({
    where: { id: inviteId },
    data: { acceptedAt: new Date() }, // marca como consumido = invalidado
  });
  await logActivity(session, "invite.cancel", `Cancelou convite de ${invite.email}`, inviteId);
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

/**
 * Reenvia o e-mail de um convite ainda válido. Não gera token novo — só
 * dispara o mail outra vez. Para o user, é "não recebi".
 * NB: como guardamos só o HASH do token, não podemos remandar o link
 * antigo. Geramos um token NOVO e atualizamos o hash.
 */
export async function resendInviteAction(inviteId: string): Promise<Result> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  if (!(await hit(`invite:resend:${session.sub}`, 20, 60 * 60_000)).ok)
    return { ok: false, error: "Muitos reenvios. Aguarde uma hora." };

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    include: { organization: { select: { name: true } } },
  });
  if (!invite || invite.organizationId !== session.org)
    return { ok: false, error: "Convite não encontrado." };
  if (invite.acceptedAt)
    return { ok: false, error: "Convite já foi aceito ou cancelado." };

  // Gera token novo (não temos como recuperar o antigo — só o hash fica salvo).
  const { plain, hash } = generateToken();
  await prisma.invite.update({
    where: { id: inviteId },
    data: {
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS), // estende validade
    },
  });

  const res = await sendTeamInviteEmail({
    to: invite.email,
    orgName: invite.organization.name,
    inviterName: session.name,
    token: plain,
  });
  if (!res.ok) {
    logger.error("Reenvio de convite — falha no e-mail", { inviteId });
    return { ok: false, error: "Não consegui enviar o e-mail." };
  }

  await logActivity(session, "invite.resend", `Reenviou convite para ${invite.email}`, inviteId);
  revalidatePath(`/espaco/${session.slug}/equipe`);
  return { ok: true };
}

export interface AcceptInviteInput {
  token: string;
  name: string;
  password: string;
}

/**
 * Aceita o convite: cria o usuário, marca o invite como usado e já loga.
 * Roda sem sessão (o usuário ainda não existe).
 */
export async function acceptInviteAction(input: AcceptInviteInput): Promise<Result> {
  const parsed = AcceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { token, name, password } = parsed.data;

  const tokenHash = hashToken(token);
  const invite = await prisma.invite.findUnique({ where: { tokenHash } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date())
    return { ok: false, error: "Convite inválido ou expirado." };

  // Pode ter race com cron de expire-trials — re-checa seats no momento do aceite.
  const seat = await checkSeatAvailability(invite.organizationId);
  if (!seat.ok) return { ok: false, error: seat.error! };

  // E-mail pode ter sido cadastrado em outra org entre convite e aceite.
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return { ok: false, error: "Esse e-mail já tem conta — faça login." };

  const passwordHash = await hashPassword(password);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        profile: invite.profile,
        permissions: invite.permissions,
        status: "active",
        organizationId: invite.organizationId,
        emailVerifiedAt: new Date(), // aceitar o convite já valida o e-mail
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    const org = await tx.organization.findUnique({
      where: { id: invite.organizationId },
      select: { slug: true },
    });
    return { user, slug: org?.slug ?? "" };
  });

  await createSession({
    sub: result.user.id,
    name,
    email: invite.email,
    role: invite.role as "OWNER" | "ADMIN" | "MEMBER",
    org: invite.organizationId,
    slug: result.slug,
    profile: invite.profile,
    permissions: invite.permissions,
  });

  return { ok: true };
}
