/**
 * Sincroniza as variáveis do .env local para o projeto Vercel (production),
 * passando os valores por STDIN — nunca por argumento (não vazam em process
 * list nem em log). Carrega via @next/env, então o escape \$ do dotenv-expand
 * já chega resolvido (valor real).
 *
 * Uso: node scripts/sync-vercel-env.mjs [--dry]
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const dry = process.argv.includes("--dry");

// Chaves que fazem sentido em produção (as ausentes no .env são puladas).
const KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_PROVIDER",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
];

// Valores fixos/derivados para produção.
const OVERRIDES = new Map([
  ["ASAAS_ENV", "sandbox"], // troque para "production" quando for cobrar de verdade
  ["CRON_SECRET", randomBytes(32).toString("hex")],
]);

function addEnv(key, value) {
  if (dry) {
    console.log(`(dry) ${key} → ${value.length} chars`);
    return true;
  }
  // Remove a existente (ignora erro se não existir) e adiciona a nova.
  spawnSync("vercel", ["env", "rm", key, "production", "--yes"], {
    stdio: "ignore",
    shell: true,
  });
  const r = spawnSync("vercel", ["env", "add", key, "production"], {
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
    shell: true,
  });
  const ok = r.status === 0;
  console.log(`${ok ? "✓" : "✖"} ${key} (${value.length} chars)${ok ? "" : ": " + r.stderr}`);
  return ok;
}

let fail = 0;
for (const key of KEYS) {
  const v = process.env[key];
  if (!v || !v.trim()) {
    console.log(`— ${key}: ausente no .env, pulando`);
    continue;
  }
  if (!addEnv(key, v.trim())) fail++;
}
for (const [key, v] of OVERRIDES) {
  if (!addEnv(key, v)) fail++;
}

console.log(fail ? `\n${fail} falha(s).` : "\nTodas as variáveis sincronizadas.");
process.exit(fail ? 1 : 0);
