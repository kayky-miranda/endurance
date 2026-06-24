/**
 * Mede a duração de cada narração e calcula os frames de cada cena.
 * Usa @remotion/media-utils (já disponível via remotion) pra ler a duração
 * do MP3 sem precisar de ffprobe instalado.
 *
 * Uso: node scripts/measure-audio.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, "..", "public", "audio");
const FPS = 30;
const PADDING = 8; // frames de respiro entre cenas

const KEYS = [
  "intro",
  "dor",
  "agitacao",
  "solucao",
  "onboarding",
  "modulos",
  "ia",
  "payoff",
  "cta",
];

const result = {};
let total = 0;

for (let i = 0; i < 9; i++) {
  const file = join(AUDIO_DIR, `v1-s${String(i + 1).padStart(2, "0")}.mp3`);
  const { durationInSeconds } = await parseMedia({
    src: file,
    fields: { durationInSeconds: true },
    reader: nodeReader,
  });
  const frames = Math.ceil(durationInSeconds * FPS) + PADDING;
  result[KEYS[i]] = frames;
  total += frames;
  console.log(
    `${KEYS[i].padEnd(12)} ${durationInSeconds.toFixed(2)}s → ${frames} frames`,
  );
}

console.log(`\nTOTAL: ${total} frames (~${(total / FPS).toFixed(1)}s)\n`);
console.log("Cole isto em src/theme.ts (SCENE_FRAMES):\n");
console.log("export const SCENE_FRAMES = {");
for (const k of KEYS) console.log(`  ${k}: ${result[k]},`);
console.log("} as const;");
