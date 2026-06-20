import "server-only";
import { logger } from "@/lib/logger";

/**
 * Provedor de e-mail transacional. Usa a HTTP API do Resend quando
 * RESEND_API_KEY está definida; sem a chave, o "envio" só loga no console
 * (útil em dev/CI — links de verificação aparecem nos logs).
 *
 * Templates ficam no próprio arquivo para reduzir indireção; quando crescer,
 * extrair para lib/emails/*.tsx (React Email).
 */

const RESEND_API = "https://api.resend.com/emails";

const FROM = process.env.EMAIL_FROM || "ENDURANCE <noreply@endurance.app>";
const APP_URL = process.env.APP_URL || "http://localhost:3200";
const RESEND_KEY = process.env.RESEND_API_KEY;

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  stub?: boolean;
}

export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  if (!RESEND_KEY) {
    logger.info("E-mail (stub) — RESEND_API_KEY ausente", {
      to: opts.to,
      subject: opts.subject,
      preview: opts.text.slice(0, 200),
    });
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error("E-mail falhou no Resend", { status: res.status, detail });
      return { ok: false, error: `resend_${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    logger.exception("E-mail falhou (network)", e);
    return { ok: false, error: "network" };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const BRAND = "ENDURANCE";

function wrap(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f6f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="padding:24px 32px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;">
      <strong style="font-size:18px;letter-spacing:1px;">${BRAND}</strong>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
      ${body}
    </div>
    <div style="padding:16px 32px;background:#f8fafc;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
      Esta mensagem foi enviada automaticamente pelo ${BRAND}. Em caso de dúvida, responda este e-mail.
    </div>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#06b6d4;color:#fff;text-decoration:none;font-weight:600;">${label}</a>`;
}

export async function sendVerificationEmail(opts: {
  to: string;
  name: string;
  token: string;
}): Promise<SendResult> {
  const url = `${APP_URL}/api/verify-email/${opts.token}`;
  const html = wrap(
    "Confirme seu e-mail",
    `<p>Olá, ${opts.name}!</p>
     <p>Para começar a usar o ${BRAND}, confirme seu e-mail clicando no botão abaixo.</p>
     <p style="margin:24px 0;">${button(url, "Confirmar e-mail")}</p>
     <p style="font-size:13px;color:#64748b;">Ou copie e cole este link no navegador:<br>
     <span style="word-break:break-all;color:#0ea5e9;">${url}</span></p>
     <p style="font-size:13px;color:#94a3b8;margin-top:24px;">O link expira em 7 dias. Se você não criou esta conta, ignore esta mensagem.</p>`,
  );
  const text = `Olá ${opts.name},\n\nConfirme seu e-mail no ${BRAND} acessando:\n${url}\n\nO link expira em 7 dias.`;
  return sendEmail({ to: opts.to, subject: `Confirme seu e-mail no ${BRAND}`, html, text });
}

export async function sendTeamInviteEmail(opts: {
  to: string;
  orgName: string;
  inviterName: string;
  token: string;
}): Promise<SendResult> {
  const url = `${APP_URL}/convite/${opts.token}`;
  const html = wrap(
    "Você foi convidado(a)",
    `<p>Olá!</p>
     <p><strong>${opts.inviterName}</strong> convidou você para fazer parte do espaço <strong>${opts.orgName}</strong> no ${BRAND}.</p>
     <p style="margin:24px 0;">${button(url, "Aceitar convite")}</p>
     <p style="font-size:13px;color:#64748b;">Ou copie e cole este link no navegador:<br>
     <span style="word-break:break-all;color:#0ea5e9;">${url}</span></p>
     <p style="font-size:13px;color:#94a3b8;margin-top:24px;">O link expira em 7 dias. Se você não esperava esse convite, ignore esta mensagem.</p>`,
  );
  const text = `Olá! ${opts.inviterName} convidou você para o espaço ${opts.orgName} no ${BRAND}. Aceite em ${url} (expira em 7 dias).`;
  return sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} convidou você para o ${opts.orgName}`,
    html,
    text,
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  token: string;
}): Promise<SendResult> {
  const url = `${APP_URL}/redefinir/${opts.token}`;
  const html = wrap(
    "Redefinir sua senha",
    `<p>Olá, ${opts.name}!</p>
     <p>Recebemos uma solicitação para redefinir sua senha no ${BRAND}.</p>
     <p style="margin:24px 0;">${button(url, "Redefinir senha")}</p>
     <p style="font-size:13px;color:#64748b;">Ou copie e cole este link no navegador:<br>
     <span style="word-break:break-all;color:#0ea5e9;">${url}</span></p>
     <p style="font-size:13px;color:#94a3b8;margin-top:24px;">O link expira em 1 hora. Se você não solicitou isso, ignore esta mensagem — sua senha continua igual.</p>`,
  );
  const text = `Olá ${opts.name},\n\nRedefina sua senha no ${BRAND} acessando:\n${url}\n\nO link expira em 1 hora. Se você não solicitou, ignore.`;
  return sendEmail({ to: opts.to, subject: `Redefinir senha no ${BRAND}`, html, text });
}
