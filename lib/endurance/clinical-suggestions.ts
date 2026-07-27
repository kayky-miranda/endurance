import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Apoio à decisão clínica: a partir do quadro descrito + CID, a IA RASCUNHA
 * exames e condutas que o profissional PODE CONSIDERAR — explicitamente como
 * sugestão para validação, nunca prescrição. Requer GEMINI_API_KEY; sem chave,
 * a feature é reportada como indisponível (NÃO fabricamos recomendação clínica
 * localmente — isso seria conteúdo médico não confiável).
 */

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

export type SuggestionSource = "ai" | "unavailable";

export async function suggestConduct(input: {
  text: string;
  cid: string;
  cidDescription: string;
}): Promise<{ text: string; source: SuggestionSource }> {
  const quadro = input.text.trim();
  if (quadro.length < 8 && !input.cid)
    return { text: "", source: "unavailable" };

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { text: "", source: "unavailable" };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const sys =
      "Você é um assistente de APOIO À DECISÃO para um profissional de saúde " +
      "habilitado. A partir do quadro clínico e do CID informados, liste de " +
      "forma concisa (bullets curtos, PT-BR) exames complementares e condutas " +
      "que o profissional PODE CONSIDERAR. Deixe claro que são sugestões para " +
      "avaliação e decisão do profissional — NÃO são prescrição nem diagnóstico " +
      "definitivo. Não invente dados do paciente. Seja objetivo (até ~8 itens).";
    const cidPart = input.cid
      ? `\nCID: ${input.cid}${input.cidDescription ? ` (${input.cidDescription})` : ""}`
      : "";
    for (const model of GEMINI_MODELS) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents: `Quadro clínico: ${quadro || "(não descrito)"}${cidPart}`,
          config: { systemInstruction: sys, temperature: 0.4, maxOutputTokens: 450 },
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
    console.error("[clinical-suggestions] IA falhou:", err);
  }
  return { text: "", source: "unavailable" };
}
