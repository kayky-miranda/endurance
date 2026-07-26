/**
 * Lógica PURA do cadastro de alunos (sem banco): as situações de matrícula e
 * seus rótulos. Reutilizável no cliente e no servidor.
 */

export type StudentStatus = "ativo" | "inativo" | "trancado";

export const STUDENT_STATUSES: StudentStatus[] = ["ativo", "inativo", "trancado"];

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  trancado: "Trancado",
};

export function isValidStudentStatus(s: string): s is StudentStatus {
  return (STUDENT_STATUSES as string[]).includes(s);
}
