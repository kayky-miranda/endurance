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

/** Timeout por tentativa — um POST pendurado não pode segurar a request. */
const TIMEOUT_MS = 10_000;
/** Tentativas totais (1 original + 2 retries) para falhas transitórias. */
const MAX_ATTEMPTS = 3;
/** Backoff base entre tentativas (multiplica pela tentativa: 300ms, 600ms). */
const BACKOFF_MS = 300;

if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "production") {
  logger.warn(
    "RESEND_API_KEY ausente em produção — e-mails ficarão em modo stub e NÃO serão entregues.",
  );
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transitório = vale a pena tentar de novo (timeout/rede, throttle, 5xx). */
function isTransient(status?: number): boolean {
  return status === undefined || status === 429 || (status >= 500 && status <= 599);
}

type PostOutcome =
  | { ok: true; id?: string }
  | { ok: false; status?: number; detail: string };

async function postToResend(key: string, body: string): Promise<PostOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, status: res.status, detail };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.info("E-mail (stub) — RESEND_API_KEY ausente", {
      to: opts.to,
      subject: opts.subject,
      preview: opts.text.slice(0, 200),
    });
    return { ok: true, stub: true };
  }

  const body = JSON.stringify({
    from: FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  let lastError = "unknown";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const out = await postToResend(key, body);
      if (out.ok) {
        if (attempt > 1)
          logger.info("E-mail enviado após retry", { to: opts.to, attempt, id: out.id });
        return { ok: true, id: out.id };
      }
      // Erro permanente (4xx que não 429: domínio não verificado, destinatário
      // inválido, etc.) — retry não ajuda, falha logo.
      if (!isTransient(out.status)) {
        logger.error("E-mail falhou no Resend (permanente)", {
          status: out.status,
          detail: out.detail,
        });
        return { ok: false, error: `resend_${out.status}` };
      }
      lastError = `resend_${out.status}`;
      logger.warn("E-mail — falha transitória do Resend", { status: out.status, attempt });
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      lastError = aborted ? "timeout" : "network";
      logger.warn("E-mail — erro de rede/timeout", { attempt, aborted });
    }
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS * attempt);
  }

  logger.error("E-mail falhou após todas as tentativas", { to: opts.to, error: lastError });
  return { ok: false, error: lastError };
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

/** Cobrança atrasada (dunning): disparado quando a assinatura vira past_due. */
export async function sendPaymentOverdueEmail(opts: {
  to: string;
  name: string;
  orgName: string;
}): Promise<SendResult> {
  const url = `${APP_URL}`;
  const html = wrap(
    "Pagamento em atraso",
    `<p>Olá, ${opts.name}!</p>
     <p>A cobrança da assinatura do espaço <strong>${opts.orgName}</strong> no ${BRAND} está <strong>em atraso</strong>.</p>
     <p>Para evitar a suspensão do acesso, regularize o pagamento pelo link da fatura que você recebeu — ou acesse a aba <strong>Assinatura</strong> dentro do sistema.</p>
     <p style="margin:24px 0;">${button(url, "Abrir o ENDURANCE")}</p>
     <p style="font-size:13px;color:#94a3b8;margin-top:24px;">Se o pagamento já foi feito, desconsidere — a confirmação pode levar alguns minutos.</p>`,
  );
  const text = `Olá ${opts.name},\n\nA cobrança da assinatura do espaço ${opts.orgName} no ${BRAND} está em atraso. Regularize para evitar a suspensão do acesso: ${url}`;
  return sendEmail({
    to: opts.to,
    subject: `Pagamento em atraso — ${opts.orgName}`,
    html,
    text,
  });
}

export interface StockDigestItem {
  name: string;
  stock: number;
  daysLeft: number | null;
  level: string; // rompido | critico
}

/** Digest diário de estoque crítico/rompido (enviado pelo cron). */
export async function sendStockDigestEmail(opts: {
  to: string;
  name: string;
  orgName: string;
  items: StockDigestItem[];
}): Promise<SendResult> {
  const rows = opts.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;">${i.name}</td>
          <td style="padding:6px 12px;text-align:right;">${i.stock} un.</td>
          <td style="padding:6px 0;color:${i.level === "rompido" ? "#dc2626" : "#d97706"};font-weight:600;">
            ${i.level === "rompido" ? "Esgotado" : i.daysLeft !== null ? `~${Math.max(1, Math.round(i.daysLeft))}d restantes` : "Crítico"}
          </td>
        </tr>`,
    )
    .join("");
  const html = wrap(
    "Alerta de estoque",
    `<p>Olá, ${opts.name}!</p>
     <p>Estes produtos do <strong>${opts.orgName}</strong> estão esgotados ou perto de acabar:</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">${rows}</table>
     <p style="margin:24px 0;">${button(`${APP_URL}`, "Repor estoque")}</p>
     <p style="font-size:13px;color:#94a3b8;">Você recebe este resumo no máximo uma vez por dia, apenas quando há itens críticos.</p>`,
  );
  const text =
    `Olá ${opts.name},\n\nProdutos com estoque crítico no ${opts.orgName}:\n` +
    opts.items
      .map((i) => `- ${i.name}: ${i.stock} un. (${i.level === "rompido" ? "esgotado" : "crítico"})`)
      .join("\n");
  return sendEmail({
    to: opts.to,
    subject: `⚠ Estoque crítico — ${opts.items.length} produto${opts.items.length > 1 ? "s" : ""} no ${opts.orgName}`,
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
