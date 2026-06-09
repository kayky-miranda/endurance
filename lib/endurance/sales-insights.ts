import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { SalesSummary } from "./sales-analytics";

export type InsightKind = "oportunidade" | "alerta" | "info";
export interface Insight {
  kind: InsightKind;
  title: string;
  text: string;
}

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Gera insights gerenciais a partir do resumo de vendas (IA + heurística). */
export async function generateSalesInsights(
  s: SalesSummary,
): Promise<{ insights: Insight[]; source: "ai" | "heuristic" }> {
  if (s.vendas === 0) {
    return {
      insights: [
        {
          kind: "info",
          title: "Sem vendas no período",
          text: "Registre vendas no PDV para liberar análises automáticas.",
        },
      ],
      source: "heuristic",
    };
  }

  const summaryText = `Resumo de vendas (${s.days} dias):
- Faturamento: ${brl(s.faturamento)} em ${s.vendas} vendas
- Ticket médio: ${brl(s.ticketMedio)}
- Itens vendidos: ${s.itens}
- Top produtos: ${s.topProdutos.map((p) => `${p.name} (${p.qty}un, ${brl(p.revenue)})`).join("; ") || "—"}
- Formas de pagamento: ${s.pagamentos.map((p) => `${PAY_LABEL[p.method] ?? p.method} ${brl(p.amount)}`).join("; ") || "—"}
- Vendedores: ${s.vendedores.map((v) => `${v.name} ${brl(v.total)}`).join("; ") || "—"}`;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema = {
        type: Type.OBJECT,
        properties: {
          insights: {
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
        required: ["insights"],
      };
      const sys = `Você é um analista de varejo. A partir do resumo de vendas, gere de 3 a 4 insights gerenciais ACIONÁVEIS em português do Brasil. Cada insight: kind (oportunidade|alerta|info), title curto (máx. 6 palavras) e text (1 frase, máx. 22 palavras). Use os NÚMEROS do resumo para ser específico. Nada genérico.`;

      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: summaryText,
            config: {
              systemInstruction: sys,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.5,
            },
          });
          const parsed = resp.text ? JSON.parse(resp.text) : null;
          const arr: Insight[] = parsed?.insights ?? [];
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
          if (out.length) return { insights: out, source: "ai" };
          break;
        } catch (e) {
          const st = (e as { status?: number })?.status;
          if ([404, 429, 500, 503].includes(st ?? 0)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[insights] IA falhou, usando heurística:", err);
    }
  }

  return { insights: heuristic(s), source: "heuristic" };
}

function heuristic(s: SalesSummary): Insight[] {
  const out: Insight[] = [];
  if (s.topProdutos[0]) {
    out.push({
      kind: "info",
      title: "Produto campeão",
      text: `${s.topProdutos[0].name} lidera com ${s.topProdutos[0].qty} unidades vendidas no período.`,
    });
  }
  if (s.pagamentos[0]) {
    const totalPag = s.pagamentos.reduce((a, p) => a + p.amount, 0) || 1;
    const pct = Math.round((s.pagamentos[0].amount / totalPag) * 100);
    out.push({
      kind: "oportunidade",
      title: "Forma de pagamento dominante",
      text: `${PAY_LABEL[s.pagamentos[0].method] ?? s.pagamentos[0].method} concentra ${pct}% do faturamento — negocie taxas.`,
    });
  }
  out.push({
    kind: "info",
    title: "Ticket médio",
    text: `Ticket médio de ${brl(s.ticketMedio)} em ${s.vendas} vendas. Ofereça combos para elevá-lo.`,
  });
  return out;
}
