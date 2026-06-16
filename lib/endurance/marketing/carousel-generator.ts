import "server-only";
import { generateStructured } from "./ai-provider";
import { resolveBrandKit } from "./carousel-templates";
import type {
  SlideData,
  SlideLayout,
  SlideBackground,
  BrandKitData,
  CampaignContent,
  GenerateCarouselInput,
} from "./types";
import type { NicheOrOther } from "@/lib/endurance/catalog";

// Blueprint fixo: layout + background definidos; a IA preenche o conteúdo.
const SLIDE_BLUEPRINT: { layout: SlideLayout; background: SlideBackground }[] =
  [
    { layout: "hero", background: "light" },
    { layout: "problem", background: "dark" },
    { layout: "solution", background: "gradient" },
    { layout: "features", background: "light" },
    { layout: "details", background: "dark" },
    { layout: "steps", background: "light" },
    { layout: "cta", background: "gradient" },
  ];

interface AiSlide {
  tag: string;
  headline: string;
  body: string;
  bullets?: { icon: string; label: string; desc: string }[];
  steps?: { num: string; title: string; desc: string }[];
  ctaText?: string;
}

interface AiOutput {
  slides: AiSlide[];
}

const SYSTEM = `Você é um especialista em marketing digital para pequenas empresas brasileiras.
Sua tarefa é criar o conteúdo textual de um carrossel de Instagram de 7 slides.
Responda exclusivamente no formato JSON estruturado solicitado.
O texto deve ser em português do Brasil, direto, persuasivo e adequado à plataforma.
Cada slide tem um propósito fixo na sequência narrativa — siga-os rigorosamente.`;

function buildJsonSchema(total: number): object {
  const slideSchema = {
    type: "object",
    properties: {
      tag: { type: "string", description: "rótulo curto (ex.: PROBLEMA, SOLUÇÃO)" },
      headline: { type: "string", description: "título impactante, até 8 palavras" },
      body: { type: "string", description: "1-2 frases de apoio ao título" },
      bullets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            icon: { type: "string", description: "emoji representativo" },
            label: { type: "string" },
            desc: { type: "string", description: "descrição curta" },
          },
          required: ["icon", "label", "desc"],
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            num: { type: "string", description: "ex.: 01, 02, 03" },
            title: { type: "string" },
            desc: { type: "string" },
          },
          required: ["num", "title", "desc"],
        },
      },
      ctaText: { type: "string", description: "texto do botão CTA (slide 7)" },
    },
    required: ["tag", "headline", "body"],
  };

  return {
    type: "object",
    properties: {
      slides: {
        type: "array",
        items: slideSchema,
      },
    },
    required: ["slides"],
    additionalProperties: false,
  };
}

function buildGeminiSchema(): object {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Type } = require("@google/genai");
  const slideSchema = {
    type: Type.OBJECT,
    properties: {
      tag: { type: Type.STRING },
      headline: { type: Type.STRING },
      body: { type: Type.STRING },
      bullets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            icon: { type: Type.STRING },
            label: { type: Type.STRING },
            desc: { type: Type.STRING },
          },
        },
      },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            num: { type: Type.STRING },
            title: { type: Type.STRING },
            desc: { type: Type.STRING },
          },
        },
      },
      ctaText: { type: Type.STRING },
    },
  };
  return {
    type: Type.OBJECT,
    properties: {
      slides: { type: Type.ARRAY, items: slideSchema },
    },
  };
}

function buildUserPrompt(input: GenerateCarouselInput): string {
  const blueprintDesc = SLIDE_BLUEPRINT.map(
    (s, i) =>
      `Slide ${i + 1} (${s.layout}): ` +
      slidePurpose(s.layout),
  ).join("\n");

  return `Crie conteúdo para um carrossel de Instagram com 7 slides para o seguinte negócio:

Empresa: ${input.orgName}
Nicho: ${input.niche}
Solicitação do usuário: "${input.prompt}"

SEQUÊNCIA OBRIGATÓRIA DOS 7 SLIDES:
${blueprintDesc}

REGRAS:
- Slide 1 (hero): headline impactante que para o scroll. Tag: nome curto do tema.
- Slide 2 (problem): problema/dor do cliente que o negócio resolve.
- Slide 3 (solution): apresente a solução/produto/serviço.
- Slides 4 e 5 (features/details): benefícios/recursos com bullets (3-4 por slide).
- Slide 6 (steps): 3 passos claros para o cliente agir.
- Slide 7 (cta): chamada para ação, inclua ctaText (ex.: "Entre em contato agora").

Retorne exatamente 7 objetos em slides[], na ordem acima.`;
}

function slidePurpose(layout: SlideLayout): string {
  const map: Record<SlideLayout, string> = {
    hero: "Hook — titular impactante para parar o scroll",
    problem: "Problema/dor do cliente",
    solution: "Apresentação da solução",
    features: "Lista de benefícios/recursos (bullets com icon+label+desc)",
    details: "Detalhes/diferenciais adicionais (bullets com icon+label+desc)",
    steps: "Passo a passo (steps com num+title+desc)",
    cta: "Chamada para ação + ctaText",
  };
  return map[layout];
}

export async function generateCarousel(
  input: GenerateCarouselInput,
): Promise<CampaignContent> {
  const brand = resolveBrandKit(
    (input.niche as NicheOrOther) ?? "outro",
    input.orgKit,
    input.orgName,
  );

  const aiOutput = await generateStructured<AiOutput>({
    system: SYSTEM,
    userPrompt: buildUserPrompt(input),
    jsonSchema: buildJsonSchema(7),
    geminiSchema: buildGeminiSchema(),
  });

  const slides: SlideData[] = SLIDE_BLUEPRINT.map((bp, i) => {
    const ai = aiOutput.slides[i] ?? { tag: "", headline: "", body: "" };
    return {
      index: i,
      layout: bp.layout,
      background: bp.background,
      tag: ai.tag ?? "",
      headline: ai.headline ?? "",
      body: ai.body ?? "",
      bullets: ai.bullets ?? [],
      steps: ai.steps ?? [],
      ctaText: ai.ctaText ?? "Fale conosco",
    };
  });

  return { slides, brand };
}
