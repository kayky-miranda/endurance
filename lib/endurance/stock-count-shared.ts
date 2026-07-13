/**
 * Parte PURA (client-safe) da conferência de estoque: tipos, rótulos e a máquina
 * de estados. Sem "server-only" nem acesso a banco — pode ser importado tanto
 * pelos server actions quanto pelos client components (badges, telas). A lógica
 * com Prisma vive em `stock-count.ts` (server-only).
 */

export type CountType = "geral" | "parcial" | "ciclica" | "localizacao";
export type CountStatus =
  | "rascunho"
  | "em_conferencia"
  | "aguardando_aprovacao"
  | "aprovada"
  | "ajustada"
  | "cancelada";

export const COUNT_TYPE_LABEL: Record<string, string> = {
  geral: "Geral",
  parcial: "Parcial",
  ciclica: "Cíclica",
  localizacao: "Por localização",
};

export const COUNT_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_conferencia: "Em conferência",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  ajustada: "Ajustada",
  cancelada: "Cancelada",
};

/** Transições permitidas da máquina de estados. */
export const COUNT_TRANSITIONS: Record<CountStatus, CountStatus[]> = {
  rascunho: ["em_conferencia", "cancelada"],
  em_conferencia: ["aguardando_aprovacao", "cancelada"],
  aguardando_aprovacao: ["aprovada", "em_conferencia", "cancelada"],
  aprovada: ["ajustada", "cancelada"],
  ajustada: [],
  cancelada: [],
};

export function canTransition(from: string, to: CountStatus): boolean {
  return (COUNT_TRANSITIONS[from as CountStatus] ?? []).includes(to);
}
