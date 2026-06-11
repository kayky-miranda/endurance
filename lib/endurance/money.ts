import type { Prisma } from "@prisma/client";

/**
 * Converte um valor monetário vindo do banco (Decimal do Prisma) para number
 * na BORDA DE LEITURA, com 2 casas. O armazenamento é exato (NUMERIC(12,2));
 * o number resultante é seguro para exibição e agregações de aplicação.
 * Escritas não precisam de conversão — o Prisma aceita number em campos Decimal.
 */
export function money(
  v: Prisma.Decimal | number | string | null | undefined,
): number {
  if (v == null) return 0;
  return Math.round(Number(v) * 100) / 100;
}
