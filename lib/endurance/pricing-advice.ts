import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { PricingAnalysis } from "./pricing";
import type { Insight, InsightKind } from "./sales-insights";

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Sugestões de preço/promoção a partir da análise de margem (IA + heurística). */
export async function generatePricingAdvice(
  a: PricingAnalysis,
): Promise<{ tips: Insight[]; source: "ai" | "heuristic" }> {
  if (a.rows.length === 0)
    return {
      tips: [
        {
          kind: "info",
          title: "Sem produtos",
          text: "Cadastre produtos com preço e custo para liberar a análise.",
        },
      ],
      source: "heuristic",
    };

  const summary = a.rows
    .slice(0, 12)
    .map(
      (r) =>
        `${r.name}: preço ${brl(r.price)}, custo ${brl(r.cost)}, margem ${r.margin}%, vendeu ${r.soldQty} no período`,
    )
    .join("; ");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema = {
        type: Type.OBJECT,
        properties: {
          tips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: {
                  type: Type.STRING,
                  enum: ["oportunidade", "alerta", "info"],
                },
                title: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ["kind", "title", "text"],
            },
          },
        },
        required: ["tips"],
      };
      const sys = `Você é um especialista em precificação de varejo. A partir da lista (preço, custo, margem, giro), gere de 3 a 4 recomendações ACIONÁVEIS em português do Brasil: ajustes de preço para produtos de margem baixa/negativa, e promoções para produtos de giro fraco. Cada item: kind (oportunidade=ganho de margem; alerta=margem baixa/negativa; info), title curto (máx 6 palavras), text (1 frase citando produto e número). Não invente produtos fora da lista.`;
      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: `Produtos: ${summary}. Margem média ${a.avgMargin}%.`,
            config: {
              systemInstruction: sys,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.5,
            },
          });
          const parsed = resp.text ? JSON.parse(resp.text) : null;
          const arr: Insight[] = parsed?.tips ?? [];
          const out = arr
            .filter((i) => i && i.title && i.text)
            .slice(0, 4)
            .map((i) => ({
              kind: (["oportunidade", "alerta", "info"].includes(i.kind)
                ? i.kind
                : "info") as InsightKind,
              title: String(i.title).slice(0, 60),
              text: String(i.text).slice(0, 160),
            }));
          if (out.length) return { tips: out, source: "ai" };
          break;
        } catch (e) {
          const st = (e as { status?: number })?.status;
          if ([404, 429, 500, 503].includes(st ?? 0)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[pricing-advice] IA falhou, heurística:", err);
    }
  }

  const tips: Insight[] = [];
  const worst = a.rows.find((r) => r.level === "negativa");
  if (worst)
    tips.push({
      kind: "alerta",
      title: "Margem negativa",
      text: `${worst.name} vende abaixo do custo (margem ${worst.margin}%). Reajuste o preço com urgência.`,
    });
  const low = a.rows.find((r) => r.level === "baixa");
  if (low)
    tips.push({
      kind: "oportunidade",
      title: "Margem baixa",
      text: `${low.name} está com margem ${low.margin}%. Um pequeno reajuste melhora o lucro.`,
    });
  const slow = [...a.rows].sort((x, y) => x.soldQty - y.soldQty)[0];
  if (slow)
    tips.push({
      kind: "info",
      title: "Giro fraco",
      text: `${slow.name} teve giro baixo (${slow.soldQty} un.). Avalie uma promoção para girar o estoque.`,
    });
  if (tips.length === 0)
    tips.push({
      kind: "info",
      title: "Margens saudáveis",
      text: `Margem média de ${a.avgMargin}%. Mantenha e monitore os custos.`,
    });
  return { tips, source: "heuristic" };
}
