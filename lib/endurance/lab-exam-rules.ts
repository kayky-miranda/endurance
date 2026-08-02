/**
 * Classificação de resultados de exame — PURA (sem "server-only" e sem Prisma).
 *
 * A leitura "está alterado?" sai da comparação do valor com a FAIXA DE
 * REFERÊNCIA registrada no próprio resultado — não de conhecimento médico
 * embutido no código nem de IA. Assim o sistema nunca "acha" que um valor é
 * anormal: ele apenas compara com a referência que veio no laudo.
 *
 * Quando o laudo não traz faixa, o resultado fica "sem referência" e NÃO é
 * classificado — melhor não dizer nada do que dizer errado.
 */

export const EXAM_FLAGS = ["normal", "baixo", "alto", "sem_referencia"] as const;
export type ExamFlag = (typeof EXAM_FLAGS)[number];

export const EXAM_FLAG_LABEL: Record<ExamFlag, string> = {
  normal: "Normal",
  baixo: "Abaixo da referência",
  alto: "Acima da referência",
  sem_referencia: "Sem faixa de referência",
};

export interface ExamRange {
  refMin: number | null;
  refMax: number | null;
}

/**
 * Quão longe do limite o valor está, em fração do próprio limite. Serve para
 * separar "levemente fora" de "muito fora" sem inventar limiar clínico: é uma
 * medida de DISTÂNCIA, não um julgamento de gravidade médica.
 */
export const SEVERE_DEVIATION = 0.5; // 50% além do limite

export interface ExamClassification {
  flag: ExamFlag;
  /** Desvio relativo ao limite ultrapassado (0 quando dentro da faixa). */
  deviation: number;
  /** Desvio grande o bastante para merecer destaque forte na tela. */
  severe: boolean;
}

export function classifyExam(
  value: number,
  range: ExamRange,
): ExamClassification {
  const { refMin, refMax } = range;
  const hasMin = typeof refMin === "number" && Number.isFinite(refMin);
  const hasMax = typeof refMax === "number" && Number.isFinite(refMax);

  if (!hasMin && !hasMax)
    return { flag: "sem_referencia", deviation: 0, severe: false };

  if (hasMax && value > (refMax as number)) {
    const limit = refMax as number;
    // Limite zero não permite desvio relativo — evita divisão por zero.
    const deviation = limit !== 0 ? (value - limit) / Math.abs(limit) : 1;
    return { flag: "alto", deviation, severe: deviation >= SEVERE_DEVIATION };
  }
  if (hasMin && value < (refMin as number)) {
    const limit = refMin as number;
    const deviation = limit !== 0 ? (limit - value) / Math.abs(limit) : 1;
    return { flag: "baixo", deviation, severe: deviation >= SEVERE_DEVIATION };
  }
  return { flag: "normal", deviation: 0, severe: false };
}

/** Texto da faixa como aparece no laudo ("70 – 99 mg/dL", "< 200", "> 40"). */
export function formatRange(range: ExamRange, unit: string): string {
  const { refMin, refMax } = range;
  const u = unit ? ` ${unit}` : "";
  if (refMin !== null && refMax !== null) return `${refMin} – ${refMax}${u}`;
  if (refMax !== null) return `< ${refMax}${u}`;
  if (refMin !== null) return `> ${refMin}${u}`;
  return "—";
}

export type ExamTrend = "subiu" | "desceu" | "estavel" | "primeiro";

/**
 * Comparação com o resultado anterior do MESMO exame. Sem juízo de valor:
 * "subiu"/"desceu" é fato; se isso é bom ou ruim depende do exame e é o
 * profissional quem lê.
 */
export function compareWithPrevious(
  current: number,
  previous: number | null,
): { trend: ExamTrend; delta: number } {
  if (previous === null) return { trend: "primeiro", delta: 0 };
  const delta = Math.round((current - previous) * 1000) / 1000;
  if (delta === 0) return { trend: "estavel", delta: 0 };
  return { trend: delta > 0 ? "subiu" : "desceu", delta };
}
