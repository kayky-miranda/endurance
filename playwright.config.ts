import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Carrega o .env (DATABASE_URL, AUTH_SECRET) para o servidor de teste e o
// teardown. As chaves de IA são esvaziadas adiante para os fluxos serem
// determinísticos (classificador offline, sem chamadas externas).
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      // Vazias = IA desligada → onboarding usa o classificador por palavras-
      // chave e os painéis de IA caem nas heurísticas. Como já estão definidas
      // no ambiente do processo, o .env não as sobrescreve no servidor.
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      AI_PROVIDER: "",
      // Vazia = e-mail em modo STUB (não chama o Resend de verdade). Garante
      // determinismo nos fluxos de verificação/reset/convite — sem isso, o app
      // tentaria enviar e-mail real para endereços @e2e.endurance.test.
      RESEND_API_KEY: "",
    },
  },
});
