"use server";

import { cookies } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import {
  generateTotpSecret,
  buildOtpauthUrl,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
} from "@/lib/totp";
import { logActivity } from "@/lib/endurance/activity-log";
import { hit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type R = { ok: true } | { ok: false; error: string };

const SETUP_COOKIE = "endurance_totp_setup";
const SETUP_TTL_SEC = 10 * 60;

/**
 * Passo 1 do setup: gera o secret + QR code, devolve pro client. O secret
 * NÃO é gravado no banco aqui — só após o usuário provar que escaneou
 * (passando o primeiro código no enable2faAction). Enquanto isso, fica num
 * cookie httpOnly de curta duração.
 */
export async function startTotpSetupAction(): Promise<
  { ok: true; qrDataUrl: string; secret: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  if (!hit(`2fa:setup:${session.sub}`, 5, 10 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { totpEnabledAt: true, email: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado." };
  if (user.totpEnabledAt)
    return { ok: false, error: "2FA já está ativo. Desative antes pra reconfigurar." };

  const secret = generateTotpSecret();
  const otpauth = buildOtpauthUrl({
    secretBase32: secret,
    accountName: user.email,
    issuer: "ENDURANCE",
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    margin: 1,
    width: 220,
    color: { dark: "#0a0f1d", light: "#ffffff" },
  });

  const store = await cookies();
  store.set(SETUP_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SETUP_TTL_SEC,
  });

  return { ok: true, qrDataUrl, secret };
}

/**
 * Passo 2: confirma com o primeiro código de 6 dígitos. Só nesse momento
 * gravamos o secret no banco e marcamos totpEnabledAt.
 */
export async function enable2faAction(
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  const store = await cookies();
  const secret = store.get(SETUP_COOKIE)?.value;
  if (!secret) return { ok: false, error: "Setup expirou. Comece de novo." };

  if (!verifyTotpCode(secret, code))
    return { ok: false, error: "Código incorreto. Confira o app de autenticação." };

  // Gera 8 backup codes; mostra plain ao usuário UMA vez e grava só o hash.
  const plainCodes = generateBackupCodes(8);
  const hashed = plainCodes.map(hashBackupCode);

  await prisma.user.update({
    where: { id: session.sub },
    data: {
      totpSecret: secret,
      totpEnabledAt: new Date(),
      totpBackupCodes: hashed,
    },
  });
  store.delete(SETUP_COOKIE);

  await logActivity(session, "2fa.enable", "2FA TOTP ativado");
  logger.info("2FA ativado", { userId: session.sub });
  return { ok: true, backupCodes: plainCodes };
}

/**
 * Regenera os 8 backup codes (descartando os anteriores). Útil quando o
 * usuário expõe a lista por engano. Mostra os novos uma vez.
 */
export async function regenerateBackupCodesAction(): Promise<
  { ok: true; backupCodes: string[] } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  if (!hit(`2fa:regen:${session.sub}`, 5, 60 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde uma hora." };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt) return { ok: false, error: "2FA não está ativo." };

  const plainCodes = generateBackupCodes(8);
  const hashed = plainCodes.map(hashBackupCode);
  await prisma.user.update({
    where: { id: session.sub },
    data: { totpBackupCodes: hashed },
  });
  await logActivity(session, "2fa.backup.regenerate", "Backup codes regenerados");
  return { ok: true, backupCodes: plainCodes };
}

/**
 * Desativar exige senha (defesa: alguém com sessão roubada não desliga sozinho).
 */
export async function disable2faAction(password: string): Promise<R> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  if (!hit(`2fa:disable:${session.sub}`, 5, 60 * 60_000).ok)
    return { ok: false, error: "Muitas tentativas. Aguarde uma hora." };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { passwordHash: true, totpEnabledAt: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado." };
  if (!user.totpEnabledAt) return { ok: false, error: "2FA já está desativado." };

  if (!(await verifyPassword(password, user.passwordHash)))
    return { ok: false, error: "Senha incorreta." };

  await prisma.user.update({
    where: { id: session.sub },
    data: { totpSecret: null, totpEnabledAt: null },
  });

  await logActivity(session, "2fa.disable", "2FA TOTP desativado");
  logger.info("2FA desativado", { userId: session.sub });
  return { ok: true };
}
