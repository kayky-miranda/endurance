// Hook do Next 15 para inicializar instrumentação (Sentry) no startup do
// servidor. Lê o config certo pra cada runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura erros que escapam pro React server (Next 15.4+). Em @sentry/nextjs
// v10 o handler já é registrado automaticamente pelo register() acima — só
// reexportamos se o usuário quiser estender. Por ora, ficamos com o default.
