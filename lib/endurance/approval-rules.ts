/**
 * Regras de workflow de aprovação de compras — funções PURAS (sem banco), por
 * isso testáveis. O nível exigido é decidido pelo valor estimado da solicitação:
 *   até R$ 5.000  → Supervisor
 *   até R$ 20.000 → Gerente
 *   acima         → Diretor
 */

export type ApprovalLevel = "supervisor" | "gerente" | "diretor";

export const APPROVAL_THRESHOLDS = {
  supervisor: 5000,
  gerente: 20000,
} as const;

const LEVEL_LABEL: Record<ApprovalLevel, string> = {
  supervisor: "Supervisor",
  gerente: "Gerente",
  diretor: "Diretor",
};

/** Nível de aprovação exigido para um valor estimado (em reais). */
export function requiredApprovalLevel(total: number): ApprovalLevel {
  const v = Number(total) || 0;
  if (v <= APPROVAL_THRESHOLDS.supervisor) return "supervisor";
  if (v <= APPROVAL_THRESHOLDS.gerente) return "gerente";
  return "diretor";
}

export function approvalLevelLabel(level: string): string {
  return LEVEL_LABEL[level as ApprovalLevel] ?? level;
}
