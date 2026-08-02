import "server-only";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODELS, isRetryableError } from "./gemini";

/**
 * Correção ortográfica/gramatical de texto livre (PT-BR). A IA corrige APENAS
 * ortografia, acentuação, pontuação e concordância — PRESERVANDO integralmente
 * o sentido, os termos técnicos, medicamentos, dosagens, números e siglas. NÃO
 * reescreve, resume nem acrescenta informação. Isso mantém a feature segura em
 * contexto clínico: nunca inventa conteúdo, só arruma a escrita.
 *
 * Requer GEMINI_API_KEY; sem chave, é reportada como indisponível (não temos um
 * corretor local confiável para PT-BR e não vale entregar correção duvidosa).
 */

export type ProofreadSource = "ai" | "unchanged" | "unavailable";

export interface ProofreadResult {
  text: string;
  source: ProofreadSource;
}

export async function proofreadText(input: string): Promise<ProofreadResult> {
  const original = (input ?? "").trim();
  if (original.length < 3) return { text: original, source: "unchanged" };

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { text: original, source: "unavailable" };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const sys =
      "Você é um corretor ortográfico e gramatical de português do Brasil. " +
      "Corrija APENAS ortografia, acentuação, pontuação, espaçamento e " +
      "concordância do texto do usuário. PRESERVE integralmente o significado, " +
      "o tom, a estrutura, as quebras de linha e TODOS os termos técnicos, " +
      "nomes de medicamentos, dosagens, unidades, siglas, CIDs e números — não " +
      "os altere. NÃO reescreva o estilo, NÃO resuma, NÃO expanda, NÃO adicione " +
      "nem remova informação, NÃO comente. Responda somente com o texto " +
      "corrigido, sem aspas nem rótulos. Se já estiver correto, repita-o igual.";
    for (const model of GEMINI_MODELS) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents: input.slice(0, 6000),
          config: {
            systemInstruction: sys,
            temperature: 0,
            maxOutputTokens: 2000,
            // Correção ortográfica é mecânica: o "pensamento" só adicionaria
            // latência (e disputaria o orçamento de saída em textos longos).
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        const text = (resp.text || "").trim();
        if (!text) break;
        return {
          text,
          source: text === original ? "unchanged" : "ai",
        };
      } catch (e) {
        if (isRetryableError(e)) continue;
        throw e;
      }
    }
  } catch (err) {
    console.error("[text-proofreading] IA falhou:", err);
  }
  return { text: original, source: "unavailable" };
}
