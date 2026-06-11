import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/db";
import { money } from "./money";

export interface Suggestion {
  id: string;
  name: string;
  price: number;
  reason: string;
}

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

/**
 * Sugere produtos complementares (cross-sell/upsell) para a venda atual.
 * Usa o Gemini quando há chave; cai numa heurística por categoria. Sempre
 * escolhe apenas do catálogo da organização (e nunca itens já no carrinho).
 */
export async function suggestCrossSell(
  orgId: string,
  cartProductIds: string[],
): Promise<Suggestion[]> {
  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
  });
  const inCart = new Set(cartProductIds);
  const cartProducts = products.filter((p) => inCart.has(p.id));
  const candidates = products.filter((p) => !inCart.has(p.id) && p.stock > 0);
  if (cartProducts.length === 0 || candidates.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema = {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, enum: candidates.map((c) => c.id) },
                reason: { type: Type.STRING },
              },
              required: ["id", "reason"],
            },
          },
        },
        required: ["suggestions"],
      };
      const sys = `Você é um assistente de vendas de um comércio. Sugira produtos COMPLEMENTARES (cross-sell/upsell) para a compra atual, escolhendo APENAS da lista de candidatos. No máximo 3 sugestões, cada uma com um motivo curto (máx. 5 palavras) em português do Brasil. Nunca repita itens do carrinho.`;
      const user = `Carrinho atual: ${cartProducts
        .map((p) => `${p.name} (${p.category || "sem categoria"})`)
        .join(", ")}\n\nCandidatos:\n${candidates
        .map((c) => `- id=${c.id} | ${c.name} (${c.category || "—"}) R$${c.price}`)
        .join("\n")}`;

      for (const model of GEMINI_MODELS) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: user,
            config: {
              systemInstruction: sys,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.4,
            },
          });
          const parsed = resp.text ? JSON.parse(resp.text) : null;
          const arr: { id: string; reason: string }[] =
            parsed?.suggestions ?? [];
          const out: Suggestion[] = [];
          for (const sug of arr) {
            const p = candidates.find((c) => c.id === sug.id);
            if (p && !out.some((o) => o.id === p.id)) {
              out.push({
                id: p.id,
                name: p.name,
                price: money(p.price),
                reason: String(sug.reason || "").slice(0, 40),
              });
            }
            if (out.length >= 3) break;
          }
          if (out.length) return out;
          break;
        } catch (e) {
          const st = (e as { status?: number })?.status;
          if ([404, 429, 500, 503].includes(st ?? 0)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[crosssell] IA falhou, usando heurística:", err);
    }
  }

  // Heurística: prioriza categorias DIFERENTES das do carrinho (complementares).
  const cats = new Set(cartProducts.map((p) => p.category).filter(Boolean));
  const diff = candidates.filter((c) => !cats.has(c.category));
  const pick = (diff.length ? diff : candidates).slice(0, 3);
  return pick.map((p) => ({
    id: p.id,
    name: p.name,
    price: money(p.price),
    reason: "Leve também",
  }));
}
