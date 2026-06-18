import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";

const ANTHROPIC_MODEL = "claude-opus-4-8";
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

export type AiProvider = "gemini" | "anthropic";

function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export function selectProvider(): AiProvider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "gemini") return hasGeminiKey() ? "gemini" : null;
  if (explicit === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (hasGeminiKey()) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export interface GenerateOptions<T> {
  system: string;
  userPrompt: string;
  jsonSchema: object;
  geminiSchema: object;
}

export async function generateStructured<T>(
  opts: GenerateOptions<T>,
): Promise<T> {
  const provider = selectProvider();
  if (!provider) throw new Error("Nenhum provedor de IA configurado.");

  if (provider === "anthropic") return callAnthropic<T>(opts);
  return callGemini<T>(opts);
}

async function callAnthropic<T>(opts: GenerateOptions<T>): Promise<T> {
  const client = new Anthropic();
  // `output_config` é beta — o tipo do SDK ainda não conhece. Mantemos via cast
  // porque ele força a saída a respeitar o JSON Schema (mais robusto que pedir
  // "retorne só JSON" no prompt).
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.userPrompt }],
    output_config: {
      format: { type: "json_schema", schema: opts.jsonSchema },
    },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Resposta vazia da IA.");
  return JSON.parse(block.text) as T;
}

async function callGemini<T>(opts: GenerateOptions<T>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: opts.userPrompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseSchema: opts.geminiSchema,
          temperature: 0.7,
        },
      });
      const out = response.text;
      if (!out) throw new Error("Resposta vazia do Gemini.");
      return JSON.parse(out) as T;
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if ([404, 429, 500, 503].includes(status ?? 0)) continue;
      throw e;
    }
  }
  throw lastErr;
}
