// Sentry — Node runtime (server actions, route handlers, server components).
// Sem SENTRY_DSN o SDK fica inerte (não envia eventos). Útil em dev/CI.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    // 10% das transações em prod por padrão — ajuste pelo volume real.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    // Reduz ruído de erros transitórios bem conhecidos.
    ignoreErrors: [
      "AbortError",
      "ECONNRESET",
      "Sessão expirada.",
    ],
    // Não mascarar IP no servidor — Sentry usa pra agrupar incidentes.
    sendDefaultPii: false,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
