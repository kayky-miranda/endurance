import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { StockAlert } from "./stock-alerts";

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

/** Recomendação em linguagem natural sobre reposição (IA + heurística). */
export async function generateStockAdvice(
  alerts: StockAlert[],
): Promise<{ text: string; source: "ai" | "heuristic" }> {
  if (alerts.length === 0)
    return {
      text: "Nenhum produto em risco de ruptura no momento — estoque saudável.",
      source: "heuristic",
    };

  const list = alerts
    .map(
      (a) =>
        `${a.name}: estoque ${a.stock}, vende ${a.soldPerDay}/dia, ${
          a.daysLeft === null ? "sem histórico" : `acaba em ~${a.daysLeft}d`
        }, sugerido repor ${a.suggestedReorder}`,
    )
    .join("; ");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const sys = `Você é um analista de estoque de varejo. Dada a lista de produtos em risco de ruptura, escreva uma recomendação curta (2 a 3 frases, em português do Brasil) priorizando o que repor primeiro e por quê, citando os prazos. Direto e prático, sem listar tudo — destaque os mais urgentes.`;
      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: `Produtos em risco: ${list}`,
            config: {
              systemInstruction: sys,
              temperature: 0.5,
              maxOutputTokens: 300,
            },
          });
          const text = (resp.text || "").trim();
          if (text) return { text, source: "ai" };
          break;
        } catch (e) {
          const st = (e as { status?: number })?.status;
          if ([404, 429, 500, 503].includes(st ?? 0)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[stock-advice] IA falhou, heurística:", err);
    }
  }

  const top = alerts
    .slice(0, 3)
    .map(
      (a) =>
        `${a.name} (${a.daysLeft === null ? "estoque baixo" : `~${a.daysLeft}d`}, repor ${a.suggestedReorder})`,
    )
    .join(", ");
  return {
    text: `Priorize a reposição de: ${top}. Revise os itens críticos ainda hoje para não perder vendas.`,
    source: "heuristic",
  };
}
