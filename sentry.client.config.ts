// Sentry — browser. Roda no client; sem DSN público o SDK fica inerte.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    // Replay de sessão só em erro — economiza cota e respeita privacidade.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        // Mascara textos e mídia por padrão (LGPD/PII).
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      // Erros típicos de extensões de navegador
      /chrome-extension/i,
      /moz-extension/i,
    ],
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });
}
