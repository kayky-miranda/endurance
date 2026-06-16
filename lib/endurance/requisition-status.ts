/**
 * Constantes e rótulos de status/prioridade da Solicitação de Compra — PURO
 * (sem banco, sem "server-only"), para ser compartilhado entre o serviço
 * (server) e os componentes de UI (client) sem puxar código de servidor para
 * o bundle do navegador.
 */

export const REQ_STATUSES = [
  "aberta",
  "em_aprovacao",
  "aprovada",
  "rejeitada",
  "convertida",
] as const;
export type ReqStatus = (typeof REQ_STATUSES)[number];

const REQ_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  convertida: "Convertida em cotação",
};

export function reqStatusLabel(s: string): string {
  return REQ_STATUS_LABEL[s] ?? s;
}

export const PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
