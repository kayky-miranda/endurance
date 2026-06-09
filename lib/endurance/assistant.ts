import "server-only";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
export interface AssistantContext {
  orgName: string;
  nicheLabel: string;
  modules: string[];
}

type Result = { ok: true; reply: string } | { ok: false; error: string };

/** Assistente operacional (chat) do ENDURANCE, via Gemini. */
export async function askAssistant(
  ctx: AssistantContext,
  messages: ChatMsg[],
): Promise<Result> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey)
    return {
      ok: false,
      error:
        "O assistente precisa de uma chave de IA (GEMINI_API_KEY) configurada.",
    };

  const sys = `Você é o assistente operacional do ENDURANCE, um ERP/sistema de gestão para pequenos negócios.
Empresa do operador: "${ctx.orgName}" — nicho ${ctx.nicheLabel}. Módulos ativos: ${ctx.modules.join(", ") || "—"}.
Ajude o operador com: como usar o sistema (PDV/caixa, cadastro de produtos, estoque, vendas, clientes, relatórios), processos do dia a dia e treinamento de novos operadores.
Dicas reais do sistema: o caixa fica no módulo PDV (botão "Iniciar venda", leitura por código de barras, desconto em R$ ou %, formas de pagamento com split, e tela cheia); produtos e estoque ficam nos módulos correspondentes; o painel executivo fica em "Relatórios & painel".
Regras: responda em português do Brasil, de forma BREVE e prática (use passos curtos quando fizer sentido). Foque no uso do sistema. Se a pergunta fugir do escopo, redirecione gentilmente.`;

  const contents = messages
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  while (contents.length && contents[0].role === "model") contents.shift();
  if (contents.length === 0)
    return { ok: false, error: "Envie uma pergunta." };

  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of GEMINI_MODELS) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sys,
            temperature: 0.6,
            maxOutputTokens: 700,
          },
        });
        const reply = (resp.text || "").trim();
        if (reply) return { ok: true, reply };
        break;
      } catch (e) {
        const st = (e as { status?: number })?.status;
        if ([404, 429, 500, 503].includes(st ?? 0)) continue;
        throw e;
      }
    }
    return {
      ok: false,
      error: "Não consegui responder agora. Tente novamente em instantes.",
    };
  } catch (err) {
    console.error("[assistant] erro:", err);
    return { ok: false, error: "Falha ao falar com a IA." };
  }
}
