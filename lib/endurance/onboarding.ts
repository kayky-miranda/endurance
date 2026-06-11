import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";
import {
  MODULES,
  NICHES,
  type NicheId,
  type NicheOrOther,
  allModuleIds,
  coreModules,
  modulesForNiche,
  nicheLabel,
} from "./catalog";
import type { OnboardingResult } from "./types";

const MODEL = "claude-opus-4-8";
// Modelos Gemini Flash a tentar em ordem (a cota gratuita varia por modelo).
// GEMINI_MODEL no .env força um específico.
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

// ---------------------------------------------------------------------------
// Schema de saída estruturada (JSON Schema nativo).
// Não dependemos do helper de Zod do SDK — JSON Schema puro é estável entre
// versões. `suggestedModules` é restrito ao enum de ids válidos do catálogo,
// então a IA nunca devolve um módulo inexistente.
// ---------------------------------------------------------------------------
const ONBOARDING_SCHEMA = {
  type: "object",
  properties: {
    niche: {
      type: "string",
      enum: [...NICHES.map((n) => n.id), "outro"],
      description: "nicho do negócio; use 'outro' se nenhum se encaixar",
    },
    confidence: {
      type: "number",
      description: "confiança na classificação do nicho, de 0 a 1",
    },
    businessName: {
      type: "string",
      description: "nome do negócio se mencionado; senão string vazia",
    },
    city: { type: "string", description: "cidade; vazio se não mencionada" },
    state: {
      type: "string",
      description: "UF/estado; vazio se não mencionado",
    },
    country: {
      type: "string",
      description: "país; 'Brasil' quando houver cidade/UF brasileira",
    },
    segment: {
      type: "string",
      description: "sub-segmento livre, ex.: 'mercadinho de bairro'",
    },
    summary: {
      type: "string",
      description:
        "1 a 2 frases em português do Brasil explicando a classificação e o que foi pré-configurado",
    },
    suggestedModules: {
      type: "array",
      items: { type: "string", enum: allModuleIds() },
      description:
        "ids dos módulos a ativar: TODOS os módulos core + os do nicho que façam sentido",
    },
  },
  required: [
    "niche",
    "confidence",
    "businessName",
    "city",
    "state",
    "country",
    "segment",
    "summary",
    "suggestedModules",
  ],
  additionalProperties: false,
} as const;

// Mesma estrutura, no formato de schema do Gemini (tipos em MAIÚSCULAS).
const ORDER = [
  "niche",
  "confidence",
  "businessName",
  "city",
  "state",
  "country",
  "segment",
  "summary",
  "suggestedModules",
];
const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    niche: { type: Type.STRING, enum: [...NICHES.map((n) => n.id), "outro"] },
    confidence: { type: Type.NUMBER },
    businessName: { type: Type.STRING },
    city: { type: Type.STRING },
    state: { type: Type.STRING },
    country: { type: Type.STRING },
    segment: { type: Type.STRING },
    summary: { type: Type.STRING },
    suggestedModules: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: allModuleIds() },
    },
  },
  required: ORDER,
  propertyOrdering: ORDER,
};

interface OnboardingJson {
  niche: NicheOrOther;
  confidence: number;
  businessName: string;
  city: string;
  state: string;
  country: string;
  segment: string;
  summary: string;
  suggestedModules: string[];
}

// ---------------------------------------------------------------------------
// Prompt de sistema = catálogo + regras. É a parte ESTÁVEL do prompt, então
// recebe cache_control (prefix caching): toda requisição de onboarding
// compartilha esse prefixo. A descrição do negócio (volátil) vai no turno
// do usuário, depois do ponto de cache.
// ---------------------------------------------------------------------------
function renderCatalog(): string {
  const lines: string[] = [];
  lines.push("MÓDULOS CORE (sempre ativar, valem para qualquer nicho):");
  for (const m of coreModules()) {
    lines.push(`- ${m.id}: ${m.label} — ${m.description}`);
  }
  for (const niche of NICHES) {
    lines.push("");
    lines.push(`MÓDULOS DO NICHO "${niche.id}" (${niche.label}):`);
    for (const m of modulesForNiche(niche.id)) {
      lines.push(`- ${m.id}: ${m.label} — ${m.description}`);
    }
  }
  return lines.join("\n");
}

const SYSTEM = `Você é o motor de onboarding do ENDURANCE, um ERP em SaaS para pequenos negócios brasileiros.
O cliente descreve o negócio em texto livre e você precisa: (1) classificar o nicho, (2) extrair os dados disponíveis e (3) escolher quais módulos do sistema ativar.

NICHOS SUPORTADOS NO MVP:
${NICHES.map((n) => `- ${n.id}: ${n.label}`).join("\n")}
- outro: quando o negócio não se encaixa em nenhum dos acima.

CATÁLOGO DE MÓDULOS (só pode escolher ids desta lista):
${renderCatalog()}

REGRAS:
- Escolha exatamente UM nicho. Use "outro" apenas se realmente não couber em nenhum.
- "confidence" reflete sua certeza no nicho (0 a 1).
- Extraia nome do negócio, cidade, UF e país quando aparecerem; deixe vazio o que não foi dito. Se houver cidade/UF brasileira, "country" = "Brasil".
- "segment" é uma descrição curta e livre do tipo de negócio (ex.: "mercadinho de bairro", "barbearia masculina").
- "suggestedModules": inclua SEMPRE todos os módulos core e, em seguida, os módulos do nicho escolhido que façam sentido para este negócio específico. Se o nicho for "outro", sugira apenas os módulos core.
- "summary": 1 a 2 frases em português do Brasil, em tom acolhedor, dizendo o que você identificou e o que já deixou pré-configurado.
- Responda exclusivamente no formato estruturado solicitado.`;

type Provider = "gemini" | "anthropic";

function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

/**
 * Decide o provedor: env explícita (AI_PROVIDER) ou autodetecção pela chave
 * presente. Gemini tem prioridade (tier gratuito) sobre a Anthropic.
 */
function selectProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "gemini") return hasGeminiKey() ? "gemini" : null;
  if (explicit === "anthropic")
    return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (hasGeminiKey()) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** Indica se há algum provedor de IA configurado. */
export function isOnboardingAIEnabled(): boolean {
  return selectProvider() !== null;
}

/**
 * Classifica o negócio a partir da descrição em texto livre.
 * Usa o provedor de IA configurado (saída estruturada); em ausência de chave ou
 * erro, cai no classificador por palavras-chave — o onboarding nunca quebra.
 */
export async function classifyBusiness(
  description: string,
): Promise<OnboardingResult> {
  const text = description.trim();
  if (!text) {
    throw new Error("Descrição vazia.");
  }

  const provider = selectProvider();
  if (!provider) return fallbackClassify(text);

  try {
    const parsed =
      provider === "gemini"
        ? await callGemini(text)
        : await callAnthropic(text);
    if (!parsed || !parsed.niche) return fallbackClassify(text);
    return normalize(parsed, "ai");
  } catch (err) {
    console.error(`[onboarding:ai:${provider}] falhou, usando fallback:`, err);
    return fallbackClassify(text);
  }
}

const userPrompt = (text: string) =>
  `Descrição do negócio do cliente:\n"""\n${text}\n"""`;

/** Claude (Anthropic) — structured outputs + prompt caching no system. */
async function callAnthropic(text: string): Promise<OnboardingJson | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    // Catálogo + regras são estáveis → cacheáveis. Descrição é volátil → user.
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt(text) }],
    output_config: {
      format: { type: "json_schema", schema: ONBOARDING_SCHEMA },
    },
  });
  // Valida o prompt caching: na 1ª requisição espera-se cache_write > 0 (prefixo
  // gravado); nas seguintes (até 5 min), cache_read > 0. Se ambos ficarem sempre
  // em 0, o prefixo está abaixo do mínimo cacheável do modelo ou algo volátil
  // entrou no system prompt (ver lib/endurance/onboarding.ts:SYSTEM).
  const u = response.usage;
  console.info(
    "[onboarding:anthropic] usage:",
    `input=${u.input_tokens}`,
    `cache_write=${u.cache_creation_input_tokens ?? 0}`,
    `cache_read=${u.cache_read_input_tokens ?? 0}`,
    `output=${u.output_tokens}`,
  );
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? JSON.parse(block.text) : null;
}

/** Gemini (Google) — tier gratuito, saída estruturada via responseSchema. */
async function callGemini(text: string): Promise<OnboardingJson | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt(text),
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          temperature: 0.2,
        },
      });
      const out = response.text;
      return out ? (JSON.parse(out) as OnboardingJson) : null;
    } catch (e) {
      lastErr = e;
      // 404 = inexistente; 429 = sem cota; 500/503 = instável → tenta o próximo.
      const status = (e as { status?: number })?.status;
      if ([404, 429, 500, 503].includes(status ?? 0)) continue;
      throw e;
    }
  }
  throw lastErr;
}

/**
 * Garante coerência: nicho válido, módulos só do core + nicho, confiança no
 * intervalo [0,1]. Vale tanto para a saída da IA quanto a do fallback.
 */
function normalize(
  raw: OnboardingJson,
  source: "ai" | "fallback",
): OnboardingResult {
  const validNiche = NICHES.some((n) => n.id === raw.niche);
  const niche: NicheOrOther = validNiche ? (raw.niche as NicheId) : "outro";

  const allowed = new Set<string>([
    ...coreModules().map((m) => m.id),
    ...(niche !== "outro"
      ? modulesForNiche(niche).map((m) => m.id)
      : []),
  ]);
  // Mantém só módulos permitidos para o nicho; garante todo o core presente.
  const picked = new Set<string>(coreModules().map((m) => m.id));
  for (const id of raw.suggestedModules ?? []) {
    if (allowed.has(id)) picked.add(id);
  }
  // Ordena seguindo a ordem do catálogo (core primeiro, depois nicho).
  const suggestedModules = MODULES.filter((m) => picked.has(m.id)).map(
    (m) => m.id,
  );

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));

  return {
    niche,
    nicheLabel: nicheLabel(niche),
    confidence,
    businessName: (raw.businessName ?? "").trim(),
    city: (raw.city ?? "").trim(),
    state: (raw.state ?? "").trim(),
    country: (raw.country ?? "").trim(),
    segment: (raw.segment ?? "").trim(),
    summary: (raw.summary ?? "").trim(),
    suggestedModules,
    source,
  };
}

// ---------------------------------------------------------------------------
// Classificador offline (sem IA). Pontua nichos por palavra-chave e extrai a
// cidade com um regex simples. Existe para o protótipo rodar sem chave da API.
// ---------------------------------------------------------------------------
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function fallbackClassify(text: string): OnboardingResult {
  const norm = stripAccents(text.toLowerCase());

  let best: { niche: NicheId; score: number } | null = null;
  for (const niche of NICHES) {
    let score = 0;
    for (const kw of niche.keywords) {
      if (norm.includes(stripAccents(kw))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { niche: niche.id, score };
    }
  }

  const niche: NicheOrOther = best ? best.niche : "outro";
  const confidence = best ? Math.min(0.9, 0.45 + 0.15 * best.score) : 0.25;

  // Extrai "... em <Cidade>[, UF]".
  let city = "";
  let state = "";
  // \p{L} (com flag u) casa letras acentuadas de forma confiável — evita
  // depender de faixas literais como À-ÿ no código-fonte.
  const m = text.match(
    /\bem\s+(\p{L}+(?:\s+\p{L}+){0,3})(?:\s*,\s*([A-Za-z]{2})\b)?/u,
  );
  if (m) {
    city = m[1].trim().replace(/\s+/g, " ");
    if (m[2]) state = m[2].toUpperCase();
  }
  const country = city || state ? "Brasil" : "";

  const label = nicheLabel(niche);
  const summary =
    niche === "outro"
      ? "Não consegui identificar o nicho com certeza pela descrição. Ative os módulos manualmente ou descreva melhor o negócio. (Configure uma chave de IA — Gemini ou Claude — no .env para usar a IA.)"
      : `Identifiquei um negócio do tipo "${label}". Já deixei pré-selecionados os módulos essenciais e os específicos desse nicho. (Classificação offline — configure uma chave de IA, Gemini ou Claude, no .env.)`;

  const suggestedModules = [
    ...coreModules().map((m) => m.id),
    ...(niche !== "outro" ? modulesForNiche(niche).map((m) => m.id) : []),
  ];

  return {
    niche,
    nicheLabel: label,
    confidence,
    businessName: "",
    city,
    state,
    country,
    segment: "",
    summary,
    suggestedModules,
    source: "fallback",
  };
}
