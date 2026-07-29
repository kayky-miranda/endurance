import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Resumo da anamnese (questionário inicial). Segue o padrão do projeto: Gemini
 * quando há chave, senão heurística LOCAL (nada sai do servidor sem chave).
 * Estritamente FACTUAL — condensa/organiza o que o paciente respondeu, destaca
 * pontos de atenção citados; NÃO diagnostica nem inventa. É apoio à leitura, não
 * conclusão clínica.
 */

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

export interface AnamneseQA {
  question: string;
  answer: string;
}

export async function summarizeAnamnese(
  patientName: string,
  items: AnamneseQA[],
): Promise<{ text: string; source: "ai" | "heuristic" }> {
  const answered = items.filter(
    (i) => (i.question ?? "").trim() && (i.answer ?? "").trim(),
  );
  if (answered.length === 0)
    return {
      text: "Nenhuma resposta preenchida para resumir.",
      source: "heuristic",
    };

  const corpus = answered
    .map((i) => `- ${i.question.trim()}: ${i.answer.trim()}`)
    .join("\n");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const sys =
        "Você é um assistente de saúde. A partir das respostas da ANAMNESE " +
        "(questionário inicial), escreva um RESUMO objetivo em português do " +
        "Brasil, em 3 a 5 frases: perfil do paciente, queixas/histórico " +
        "relevantes e pontos de atenção que o profissional deve observar. Seja " +
        "FACTUAL — use apenas o que foi respondido, NÃO invente dados, NÃO " +
        "diagnostique nem sugira tratamento. Sintetize, não copie pergunta a " +
        "pergunta.";
      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: `Paciente: ${patientName}\nRespostas:\n${corpus}`,
            config: { systemInstruction: sys, temperature: 0.3, maxOutputTokens: 400 },
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
      console.error("[anamnese-summary] IA falhou, heurística:", err);
    }
  }

  // Heurística local: contagem + amostra das primeiras respostas, sem inventar.
  const sample = answered
    .slice(0, 4)
    .map((i) => {
      const a = i.answer.trim();
      return `${i.question.trim()}: ${a.length > 120 ? `${a.slice(0, 120)}…` : a}`;
    })
    .join("; ");
  return {
    text: `${answered.length} resposta(s) preenchida(s). ${sample}.`,
    source: "heuristic",
  };
}
