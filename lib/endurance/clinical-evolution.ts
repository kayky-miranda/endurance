import "server-only";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODELS, isRetryableError } from "./gemini";
import type { PatientContext } from "./clinical-analysis";

/**
 * Redação da EVOLUÇÃO CLÍNICA — economiza o tempo que o profissional gasta
 * transformando anotações soltas em texto técnico.
 *
 * DECISÃO DE PROJETO (segurança): a IA NÃO sabe o que aconteceu na consulta de
 * hoje. Se pedíssemos "escreva a evolução", ela INVENTARIA a queixa, a resposta
 * ao tratamento e o exame físico. Por isso ela atua como REDATORA, não como
 * autora: o profissional escreve as notas cruas ("melhorou dor, ainda cansa ao
 * subir escada") e a IA estrutura em texto técnico, usando o histórico apenas
 * como contexto para nomear corretamente o que já está registrado.
 *
 * Sem notas do profissional, o rascunho fica restrito ao que É fato no cadastro
 * (motivo do acompanhamento, tempo de seguimento) e deixa explícito o que falta
 * preencher — nunca preenche por conta própria.
 */

export type EvolutionSource = "ai" | "unavailable";

const SYSTEM = `Você redige EVOLUÇÃO CLÍNICA para o prontuário de um profissional de saúde habilitado, em português do Brasil.

Você recebe: (1) as ANOTAÇÕES CRUAS do profissional sobre a consulta de hoje e (2) o HISTÓRICO do paciente, como contexto.

REGRAS INEGOCIÁVEIS:
- O conteúdo da consulta de hoje vem EXCLUSIVAMENTE das anotações cruas. NUNCA invente queixa, sintoma, medida, exame físico, resposta ao tratamento ou conduta que não esteja lá.
- O histórico serve só para dar contexto e nomear corretamente o que já está registrado (ex.: citar a condição em acompanhamento). NÃO transforme histórico em achado de hoje.
- Se as anotações forem vazias ou insuficientes, escreva apenas o que é fato do cadastro e termine com "[completar: ...]" indicando o que falta. NÃO preencha por suposição.
- Não prescreva e não conclua diagnóstico.

ESTILO: prosa técnica, impessoal, 2 a 5 frases, em um único parágrafo corrido. Terceira pessoa ("Paciente refere…", "Mantém…", "Nega…"). Sem títulos, sem listas, sem preâmbulo — devolva SOMENTE o texto da evolução.`;

export async function draftEvolution(
  input: { notes: string; ctx: PatientContext },
  opts: { signal?: AbortSignal } = {},
): Promise<{ text: string; source: EvolutionSource }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { text: "", source: "unavailable" };

  const raw = (input.notes ?? "").trim().slice(0, 3000);
  const contents =
    `# ANOTAÇÕES CRUAS DA CONSULTA DE HOJE\n${raw || "(o profissional ainda não anotou nada)"}\n\n` +
    `# HISTÓRICO DO PACIENTE (contexto, NÃO é o que aconteceu hoje)\n${input.ctx.dossier}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of GEMINI_MODELS) {
      if (opts.signal?.aborted) return { text: "", source: "unavailable" };
      try {
        const resp = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM,
            temperature: 0.3,
            maxOutputTokens: 600,
            // Redigir é reescrita, não raciocínio: o "pensamento" só somaria
            // latência e disputaria o orçamento de saída (truncando o texto).
            thinkingConfig: { thinkingBudget: 0 },
            ...(opts.signal ? { abortSignal: opts.signal } : {}),
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
    console.error("[clinical-evolution] falhou:", err);
  }
  return { text: "", source: "unavailable" };
}
