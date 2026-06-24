/**
 * Gera os 9 áudios de narração do vídeo via ElevenLabs.
 *
 * Uso (a partir de video/):
 *   ELEVENLABS_API_KEY=sk_... node scripts/generate-narration.mjs
 *   # ou com a chave no .env do projeto:
 *   node --env-file=../.env scripts/generate-narration.mjs
 *
 * Salva v1-s01.mp3 … v1-s09.mp3 em public/audio/.
 * Config de voz conforme PROMPT.md (ajuste VOICE_ID se você mudou).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "audio");

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) {
  console.error(
    "✖ Defina ELEVENLABS_API_KEY no ambiente (ou .env). Ex.:\n" +
      "  node --env-file=../.env scripts/generate-narration.mjs",
  );
  process.exit(1);
}

// Voz e modelo (PROMPT.md). Sobrescreva via env se você ajustou.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "gJx1vCzNCD1EQHT212Ls";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0.6,
  use_speaker_boost: true,
};

const SCRIPT = [
  "Apresentando o Endurance. ERP com IA para pequenos negócios brasileiros.",
  "Você tem um mercadinho. Uma academia. Um salão. Mas configurar um sistema leva dias — e ainda assim não encaixa no seu negócio.",
  "Ferramentas genéricas. Módulos que você não usa. Configurações que não fazem sentido pro seu nicho.",
  "Com o Endurance, você descreve o seu negócio em texto livre. A IA classifica, extrai os dados e já configura tudo.",
  "Em segundos, o seu espaço nasce pronto: PDV, estoque, financeiro, fiscal e CRM — só o que você precisa.",
  "Venda, controle o caixa, emita NFC-e, gerencie fornecedores e entenda seus clientes — tudo integrado, tudo em um lugar.",
  "A IA não some depois do cadastro. Ela sugere preços, prevê recompras, gera relatórios e responde suas dúvidas em qualquer tela.",
  "Do zero a um ERP completo, configurado pro seu negócio. Em menos de dois minutos.",
  "Comece grátis em endurance.app",
];

async function tts(text, index) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${detail}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `v1-s${String(index + 1).padStart(2, "0")}.mp3`;
  await writeFile(join(OUT_DIR, name), buf);
  console.log(`✓ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Gerando ${SCRIPT.length} áudios (voz ${VOICE_ID})…`);
  for (let i = 0; i < SCRIPT.length; i++) {
    await tts(SCRIPT[i], i);
  }
  console.log("\nPronto. Agora rode scripts/measure-audio.mjs ou ajuste o timing.");
})().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
