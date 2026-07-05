/**
 * Status do Pedido de Compra — PURO (sem banco / sem server-only), para o
 * serviço (server) e a UI (client). Ciclo de vida:
 *   aberto → enviado → confirmado → (parcial) → recebido | cancelado
 */

export const PO_STATUSES = [
  "aberto",
  "enviado",
  "confirmado",
  "parcial",
  "recebido",
  "cancelado",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

const LABEL: Record<string, string> = {
  aberto: "Aberto",
  enviado: "Enviado",
  confirmado: "Confirmado",
  parcial: "Parcialmente recebido",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export function poStatusLabel(s: string): string {
  return LABEL[s] ?? s;
}

/** Status que ainda permitem cancelar / agir sobre o pedido. */
export function poIsOpen(s: string): boolean {
  return s !== "recebido" && s !== "cancelado";
}
