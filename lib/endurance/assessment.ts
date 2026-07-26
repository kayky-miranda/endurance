/**
 * Lógica PURA da avaliação física (sem banco): cálculo e classificação de IMC.
 * Reutilizável no cliente e no servidor.
 */

/** IMC = peso(kg) / altura(m)². Devolve null se faltar peso ou altura. */
export function computeImc(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type ImcClass =
  | "abaixo"
  | "normal"
  | "sobrepeso"
  | "obesidade_1"
  | "obesidade_2"
  | "obesidade_3";

export const IMC_LABEL: Record<ImcClass, string> = {
  abaixo: "Abaixo do peso",
  normal: "Peso normal",
  sobrepeso: "Sobrepeso",
  obesidade_1: "Obesidade grau I",
  obesidade_2: "Obesidade grau II",
  obesidade_3: "Obesidade grau III",
};

/** Faixas da OMS para IMC adulto. */
export function imcClass(imc: number | null): ImcClass | null {
  if (imc === null) return null;
  if (imc < 18.5) return "abaixo";
  if (imc < 25) return "normal";
  if (imc < 30) return "sobrepeso";
  if (imc < 35) return "obesidade_1";
  if (imc < 40) return "obesidade_2";
  return "obesidade_3";
}
