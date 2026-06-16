/**
 * Status da Cotação — PURO (sem banco / sem server-only), compartilhado entre o
 * serviço (server) e a UI (client). Mesmo padrão de requisition-status.
 */

export const QUOTATION_STATUSES = [
  "aberta",
  "respondida",
  "fechada",
  "cancelada",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

const LABEL: Record<string, string> = {
  aberta: "Aberta",
  respondida: "Respondida",
  fechada: "Fechada",
  cancelada: "Cancelada",
};

export function quotationStatusLabel(s: string): string {
  return LABEL[s] ?? s;
}

/** Critérios do comparativo (ranking). */
export type RankCriterion = "preco" | "prazo" | "avaliacao";
