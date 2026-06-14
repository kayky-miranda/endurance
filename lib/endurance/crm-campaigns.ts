import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { CrmInsights } from "./crm";
import type { Insight, InsightKind } from "./sales-insights";

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

/** Sugestões de campanhas de fidelização/recompra (IA + heurística). */
export async function generateCrmCampaigns(
  ci: CrmInsights,
): Promise<{ campaigns: Insight[]; source: "ai" | "heuristic" }> {
  if (ci.total === 0)
    return {
      campaigns: [
        {
          kind: "info",
          title: "Sem clientes ainda",
          text: "Cadastre clientes no PDV para liberar campanhas de fidelização.",
        },
      ],
      source: "heuristic",
    };

  const summary = `Base de clientes: ${ci.total} no total. Segmentos: ${ci.counts.ativo} ativos, ${ci.counts.em_risco} em risco (30-60d sem comprar), ${ci.counts.inativo} inativos (>60d), ${ci.counts.novo} sem compras. Ticket médio por cliente: R$${ci.ticketMedio}. Previstos para recompra agora: ${ci.dueCount}.`;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema = {
        type: Type.OBJECT,
        properties: {
          campaigns: {
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
        required: ["campaigns"],
      };
      const sys = `Você é especialista em CRM e marketing de varejo. A partir dos segmentos de clientes, proponha de 3 a 4 campanhas/ações ACIONÁVEIS para fidelizar e estimular recompra, em português do Brasil. Cada item: kind (oportunidade|alerta|info), title curto (máx. 6 palavras) e text (1 frase com a ação e o público-alvo, citando os números). Seja específico e prático.`;

      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: summary,
            config: {
              systemInstruction: sys,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.6,
            },
          });
          const parsed = resp.text ? JSON.parse(resp.text) : null;
          const arr: Insight[] = parsed?.campaigns ?? [];
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
          if (out.length) return { campaigns: out, source: "ai" };
          break;
        } catch (e) {
          const st = (e as { status?: number })?.status;
          if ([404, 429, 500, 503].includes(st ?? 0)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[crm-campaigns] IA falhou, heurística:", err);
    }
  }

  const out: Insight[] = [];
  if (ci.dueCount)
    out.push({
      kind: "oportunidade",
      title: "Estimular recompra",
      text: `${ci.dueCount} cliente(s) estão na hora de recomprar — envie lembrete ou oferta personalizada.`,
    });
  if (ci.counts.em_risco)
    out.push({
      kind: "alerta",
      title: "Clientes em risco",
      text: `${ci.counts.em_risco} cliente(s) sem comprar há 30-60 dias — reative com um cupom de retorno.`,
    });
  if (ci.counts.inativo)
    out.push({
      kind: "info",
      title: "Reativar inativos",
      text: `${ci.counts.inativo} inativo(s) (>60 dias) — campanha "sentimos sua falta" com desconto.`,
    });
  if (out.length === 0)
    out.push({
      kind: "info",
      title: "Base saudável",
      text: "Maioria dos clientes ativos — crie um programa de pontos para fidelizar.",
    });
  return { campaigns: out, source: "heuristic" };
}
