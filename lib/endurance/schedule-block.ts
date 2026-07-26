/**
 * Lógica PURA dos bloqueios de agenda (sem banco): tipos de bloqueio e rótulos.
 * Reutilizável no cliente e no servidor.
 */

export type BlockKind = "bloqueio" | "ferias" | "feriado" | "almoco" | "outro";

export const BLOCK_KINDS: { value: BlockKind; label: string }[] = [
  { value: "bloqueio", label: "Bloqueio" },
  { value: "almoco", label: "Almoço" },
  { value: "ferias", label: "Férias" },
  { value: "feriado", label: "Feriado" },
  { value: "outro", label: "Outro" },
];

const LABELS: Record<BlockKind, string> = {
  bloqueio: "Bloqueio",
  almoco: "Almoço",
  ferias: "Férias",
  feriado: "Feriado",
  outro: "Outro",
};

export function isValidBlockKind(s: string): s is BlockKind {
  return s in LABELS;
}

export function blockKindLabel(kind: string): string {
  return isValidBlockKind(kind) ? LABELS[kind] : kind;
}
