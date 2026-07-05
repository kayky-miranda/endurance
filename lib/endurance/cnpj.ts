/**
 * Validação e formatação de CNPJ — funções puras (sem banco, sem rede), por
 * isso testáveis isoladamente. Usadas no cadastro de fornecedores e em qualquer
 * lugar que receba CNPJ digitado pelo usuário.
 */

/** Mantém só os dígitos (remove pontos, barras, traços e espaços). */
export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Formata 14 dígitos como 00.000.000/0000-00. Entrada parcial é tolerada. */
export function formatCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Valida CNPJ pelos dígitos verificadores (módulo 11). Rejeita sequências
 * repetidas (00000000000000, 11111111111111, …) que passam na conta mas são
 * inválidas na prática.
 */
export function isValidCnpj(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calcDigit = (base: string): number => {
    // Pesos do CNPJ: começam em 5 (1º dígito) ou 6 (2º), decrescem até 2.
    let factor = base.length - 7;
    let sum = 0;
    for (const ch of base) {
      sum += Number(ch) * factor;
      factor = factor === 2 ? 9 : factor - 1;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const dv1 = calcDigit(d.slice(0, 12));
  const dv2 = calcDigit(d.slice(0, 12) + dv1);
  return d.slice(12) === `${dv1}${dv2}`;
}
