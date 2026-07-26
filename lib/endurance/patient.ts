/**
 * Lógica PURA do cadastro de paciente (sem banco): validação de CPF (dígitos
 * verificadores reais), opções de campos e formatação. Reutilizável no cliente
 * (feedback imediato) e no servidor (fonte da verdade da validação).
 */

export const SEX_OPTIONS = [
  { value: "F", label: "Feminino" },
  { value: "M", label: "Masculino" },
  { value: "outro", label: "Outro" },
] as const;

export const MARITAL_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
] as const;

export const ATTACHMENT_CATEGORIES = [
  { value: "documento", label: "Documento" },
  { value: "exame", label: "Exame" },
  { value: "receita", label: "Receita" },
  { value: "foto", label: "Foto" },
  { value: "outro", label: "Outro" },
] as const;

export const onlyDigits = (s: string): string => (s ?? "").replace(/\D/g, "");

/** Validação de CPF pelos dois dígitos verificadores (algoritmo oficial). */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais (111... etc.)

  const digit = (sliceLen: number): number => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) {
      sum += Number(cpf[i]) * (sliceLen + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Formata "12345678901" → "123.456.789-01" (deixa como está se não tiver 11). */
export function formatCpf(raw: string): string {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return raw ?? "";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/** Idade em anos a partir da data de nascimento (null se ausente/futura). */
export function ageFromBirth(birth: Date | null | undefined, now = new Date()): number | null {
  if (!birth) return null;
  const b = birth instanceof Date ? birth : new Date(birth);
  if (isNaN(b.getTime()) || b > now) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
