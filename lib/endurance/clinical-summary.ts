import "server-only";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODELS, isRetryableError } from "./gemini";

/**
 * Resumo das anotações clínicas do paciente. Segue o padrão do projeto: usa o
 * Gemini quando há GEMINI_API_KEY, senão cai numa heurística LOCAL (nenhum dado
 * clínico sai do servidor sem chave configurada). Sempre factual — o prompt
 * instrui a NÃO inventar; o resumo só condensa o que já está escrito.
 */

export interface NoteForSummary {
  createdAt: string; // ISO
  title: string;
  content: string;
  cid: string;
  cidDescription: string;
}

const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export async function summarizeClinicalNotes(
  patientName: string,
  notes: NoteForSummary[],
): Promise<{ text: string; source: "ai" | "heuristic" }> {
  if (notes.length === 0)
    return { text: "Sem anotações clínicas para resumir.", source: "heuristic" };

  // Anotações mais recentes primeiro, limitadas para caber no contexto.
  const recent = notes.slice(0, 12);
  const corpus = recent
    .map(
      (n) =>
        `[${dt(n.createdAt)}${n.cid ? ` · CID ${n.cid}` : ""}${n.title ? ` · ${n.title}` : ""}] ${n.content}`,
    )
    .join("\n");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const sys =
        "Você é um assistente clínico. A partir das anotações do prontuário " +
        "(ordem cronológica inversa), escreva um RESUMO objetivo em português do " +
        "Brasil, em 3 a 5 frases: evolução do quadro, condutas e pontos de atenção. " +
        "Seja FACTUAL — use apenas o que está escrito, NÃO invente diagnósticos, " +
        "medicamentos ou dados. Não repita datas item a item; sintetize.";
      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: `Paciente: ${patientName}\nAnotações:\n${corpus}`,
            config: {
              systemInstruction: sys,
              temperature: 0.3,
              maxOutputTokens: 600,
              // Ver anamnese-summary: thinking ligado truncava o resumo.
              thinkingConfig: { thinkingBudget: 0 },
            },
          });
          const text = (resp.text || "").trim();
          if (text) return { text, source: "ai" };
          break;
        } catch (e) {
          if (isRetryableError(e)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[clinical-summary] IA falhou, heurística:", err);
    }
  }

  // Heurística local: dados factuais condensados, sem inventar nada.
  const cids = Array.from(
    new Set(recent.filter((n) => n.cid).map((n) => n.cid)),
  );
  const last = recent[0];
  const snippet =
    last.content.length > 260 ? `${last.content.slice(0, 260)}…` : last.content;
  const parts = [
    `${notes.length} anotação(ões) no prontuário.`,
    cids.length > 0 ? `CIDs registrados: ${cids.join(", ")}.` : "",
    `Última anotação (${dt(last.createdAt)}): ${snippet}`,
  ].filter(Boolean);
  return { text: parts.join(" "), source: "heuristic" };
}
