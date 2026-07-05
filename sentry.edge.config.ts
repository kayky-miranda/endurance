// Sentry — Edge runtime (middleware). Atualmente o middleware do projeto faz
// muito pouco, mas mantemos o SDK ativo para capturar exceções não vistas.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
