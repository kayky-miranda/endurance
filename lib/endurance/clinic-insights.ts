import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { Insight, InsightKind } from "./sales-insights";
import type { ProductivityReport } from "./productivity";
import { GEMINI_MODELS, isRetryableError } from "./gemini";

/**
 * Insights gerenciais da clínica (IA + heurística) a partir do relatório de
 * produtividade do período: comparecimento, faturamento, ticket, distribuição
 * entre profissionais. Analítico e operacional — NÃO é conteúdo clínico nem
 * conselho médico; é gestão do consultório. Sempre entrega algo: sem chave de
 * IA, cai numa heurística determinística sobre os próprios números.
 */

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface ClinicInsightInput {
  periodLabel: string;
  report: ProductivityReport;
  totalCommission: number;
}

/** Números agregados do período, reaproveitados pela IA e pela heurística. */
function digest(input: ClinicInsightInput) {
  const { report } = input;
  const totalFaltas = report.rows.reduce((s, r) => s + r.faltas, 0);
  const finalized = report.totalAtendidos + totalFaltas;
  const attendanceRate = finalized > 0 ? report.totalAtendidos / finalized : 0;
  const avgTicket =
    report.totalAtendidos > 0 ? report.totalRevenue / report.totalAtendidos : 0;
  return { totalFaltas, finalized, attendanceRate, avgTicket };
}

export async function generateClinicInsights(
  input: ClinicInsightInput,
): Promise<{ insights: Insight[]; source: "ai" | "heuristic" }> {
  const { report, periodLabel } = input;
  if (report.rows.length === 0 || report.totalAtendidos === 0) {
    return {
      insights: [
        {
          kind: "info",
          title: "Sem atendimentos no período",
          text: "Registre consultas atendidas na agenda para liberar as análises.",
        },
      ],
      source: "heuristic",
    };
  }

  const d = digest(input);
  const summaryText = `Relatório da clínica (${periodLabel}):
- Atendimentos: ${report.totalAtendidos}; Faltas: ${d.totalFaltas}; Comparecimento: ${Math.round(d.attendanceRate * 100)}%
- Faturamento: ${brl(report.totalRevenue)}; Ticket médio: ${brl(d.avgTicket)}
- Comissões no período: ${brl(input.totalCommission)}
- Por profissional: ${report.rows
    .map(
      (r) =>
        `${r.professional} (${r.atendidos} atend., ${r.faltas} faltas, comparec. ${Math.round(
          r.attendanceRate * 100,
        )}%, ${brl(r.revenue)}, ticket ${brl(r.avgTicket)})`,
    )
    .join("; ")}`;

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
                kind: { type: Type.STRING, enum: ["oportunidade", "alerta", "info"] },
                title: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ["kind", "title", "text"],
            },
          },
        },
        required: ["insights"],
      };
      const sys =
        "Você é um analista de gestão de clínicas/consultórios. A partir do " +
        "relatório operacional (produtividade, comparecimento e faturamento por " +
        "profissional), gere de 3 a 4 insights gerenciais ACIONÁVEIS em PT-BR. " +
        "Cada insight: kind (oportunidade|alerta|info), title curto (máx. 6 " +
        "palavras) e text (1 frase, máx. 22 palavras). Use os NÚMEROS do " +
        "relatório para ser específico. Foco em agenda, comparecimento, ocupação " +
        "e faturamento — NUNCA conteúdo clínico ou conselho médico. Nada genérico.";

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
          if (isRetryableError(e)) continue;
          throw e;
        }
      }
    } catch (err) {
      console.error("[clinic-insights] IA falhou, usando heurística:", err);
    }
  }

  return { insights: heuristic(input, d), source: "heuristic" };
}

function heuristic(
  input: ClinicInsightInput,
  d: ReturnType<typeof digest>,
): Insight[] {
  const { report } = input;
  const out: Insight[] = [];

  // Comparecimento: alerta se baixo, info caso contrário.
  const pct = Math.round(d.attendanceRate * 100);
  if (d.finalized >= 3 && d.attendanceRate < 0.75) {
    out.push({
      kind: "alerta",
      title: "Comparecimento baixo",
      text: `Só ${pct}% de comparecimento (${d.totalFaltas} faltas). Reforce a confirmação de consultas.`,
    });
  } else {
    out.push({
      kind: "info",
      title: "Comparecimento",
      text: `${pct}% de comparecimento no período, com ${report.totalAtendidos} atendimentos.`,
    });
  }

  // Profissional destaque.
  const top = report.rows[0];
  if (top) {
    out.push({
      kind: "info",
      title: "Profissional destaque",
      text: `${top.professional} lidera com ${top.atendidos} atendimentos e ${brl(top.revenue)} no período.`,
    });
  }

  // Quem mais falta (entre os com histórico).
  const worst = [...report.rows]
    .filter((r) => r.atendidos + r.faltas >= 3)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)[0];
  if (worst && worst.attendanceRate < 0.7 && worst !== top) {
    out.push({
      kind: "oportunidade",
      title: "Agenda a proteger",
      text: `${worst.professional} tem ${Math.round(worst.attendanceRate * 100)}% de comparecimento — priorize confirmação e overbooking leve.`,
    });
  }

  // Ticket médio.
  out.push({
    kind: "info",
    title: "Ticket médio",
    text: `Ticket médio de ${brl(d.avgTicket)} por atendimento. Avalie pacotes e retornos para elevá-lo.`,
  });

  return out.slice(0, 4);
}
