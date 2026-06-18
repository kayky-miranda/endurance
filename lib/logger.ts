import "server-only";

/**
 * Logger estruturado para uso em rotas, server actions e services.
 *
 * Em produção, emite JSON line — fácil de ingerir em Vercel Logs / Datadog /
 * Loki. Em dev, formata humanamente com cores. Erros (warn/error/exception)
 * também são propagados ao Sentry quando SENTRY_DSN está definido.
 *
 * Não enviar dados pessoais (CPF, e-mail, telefone) no `meta` sem mascarar.
 */

type Level = "debug" | "info" | "warn" | "error";

// Carrega o Sentry só quando o DSN está presente, e via import dinâmico —
// evita arrastar o SDK no bundle de quem não usa.
type SentryLike = {
  captureException: (err: unknown, ctx?: { level?: string; extra?: unknown }) => void;
  captureMessage: (msg: string, ctx?: { level?: string; extra?: unknown }) => void;
};
let sentryPromise: Promise<SentryLike | null> | null = null;
async function getSentry(): Promise<SentryLike | null> {
  if (!process.env.SENTRY_DSN) return null;
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then(
      (m) => m as unknown as SentryLike,
      () => null,
    );
  }
  return sentryPromise;
}

interface LogMeta {
  [key: string]: unknown;
}

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? "info";
const isProd = process.env.NODE_ENV === "production";

function shouldEmit(level: Level): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskDoc(doc: string): string {
  const digits = doc.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

/** Mascara campos sensíveis conhecidos antes de logar. */
function sanitize(meta: LogMeta): LogMeta {
  const out: LogMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v == null) continue;
    if (typeof v === "string") {
      if (/email/i.test(k)) out[k] = maskEmail(v);
      else if (/cpf|cnpj|document/i.test(k)) out[k] = maskDoc(v);
      else if (/password|secret|token|apikey/i.test(k)) out[k] = "***";
      else out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, msg: string, meta?: LogMeta): void {
  if (!shouldEmit(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? sanitize(meta) : {}),
  };
  const target = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (isProd) {
    target(JSON.stringify(payload));
  } else {
    const tag = { debug: "🐛", info: "·", warn: "⚠", error: "✖" }[level];
    target(`${tag} [${level}] ${msg}`, meta ?? "");
  }
}

function forwardToSentry(
  level: "warning" | "error",
  msg: string,
  err: unknown,
  meta?: LogMeta,
): void {
  // fire-and-forget — não bloqueia o caller.
  void getSentry().then((s) => {
    if (!s) return;
    const extra = meta ? sanitize(meta) : undefined;
    if (err) s.captureException(err, { level, extra: { msg, ...extra } });
    else s.captureMessage(msg, { level, extra });
  });
}

export const logger = {
  debug: (msg: string, meta?: LogMeta) => emit("debug", msg, meta),
  info: (msg: string, meta?: LogMeta) => emit("info", msg, meta),
  warn: (msg: string, meta?: LogMeta) => {
    emit("warn", msg, meta);
    forwardToSentry("warning", msg, null, meta);
  },
  error: (msg: string, meta?: LogMeta) => {
    emit("error", msg, meta);
    forwardToSentry("error", msg, null, meta);
  },

  /** Loga um erro com stack capturada e contexto. Use no catch. */
  exception: (msg: string, err: unknown, meta?: LogMeta) => {
    const e = err instanceof Error ? err : new Error(String(err));
    emit("error", msg, {
      ...meta,
      error: e.message,
      stack: e.stack?.split("\n").slice(0, 5).join("\n"),
    });
    forwardToSentry("error", msg, e, meta);
  },
};
