/**
 * Contrato da análise clínica assistida — PURO (sem "server-only"): o servidor
 * produz, o cliente renderiza os cartões, os testes verificam. Manter aqui
 * evita o erro clássico de importar valor de um módulo server-only no cliente.
 */

export const PRIORITIES = ["baixa", "media", "alta"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/**
 * Item de uma lista da análise. `source` separa o que está ESCRITO no cadastro
 * do que a IA INFERIU — exigência de segurança: o profissional precisa saber o
 * que é fato registrado e o que é leitura da máquina.
 */
export interface AnalysisItem {
  text: string;
  source: "registro" | "inferencia";
}

export interface ClinicalAnalysis {
  /** 1. Resumo executivo. */
  resumo: string;
  /** 2. Queixa principal (vazio se não registrada). */
  queixaPrincipal: string;
  /** 3. Histórico clínico relevante. */
  historico: AnalysisItem[];
  /** 4. Fatores de risco. */
  fatoresRisco: AnalysisItem[];
  /** 5. Alertas importantes (alergias, interações, sinais de gravidade). */
  alertas: AnalysisItem[];
  medicamentos: AnalysisItem[];
  alergias: AnalysisItem[];
  doencasPrevias: AnalysisItem[];
  habitos: AnalysisItem[];
  /** Contradições/lacunas percebidas nas respostas. */
  inconsistencias: AnalysisItem[];
  /** 6. Hipóteses — explicitamente NÃO diagnósticas. */
  hipoteses: AnalysisItem[];
  /** 7. Perguntas complementares para a consulta. */
  perguntasSugeridas: string[];
  /** 8. Exames que podem ser considerados. */
  examesSugeridos: string[];
  /** 9. Recomendações para conduzir a consulta. */
  recomendacoes: string[];
  /** Checklist do que ainda falta investigar. */
  aInvestigar: string[];
  /** 10. Conclusão. */
  conclusao: string;
  prioridade: Priority;
  /** Justificativa curta da prioridade. */
  prioridadeMotivo: string;
  /** true quando o cadastro tem pouco conteúdo para uma análise honesta. */
  dadosInsuficientes: boolean;
}

export function isValidPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}

/** Aviso legal exibido junto da análise — apoio à decisão, nunca substituição. */
export const AI_DISCLAIMER =
  "Apoio à decisão clínica gerado por IA a partir dos dados cadastrados. " +
  "Não é diagnóstico e não substitui o julgamento do profissional.";
