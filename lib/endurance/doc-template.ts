/**
 * Constantes PURAS dos modelos de documento (sem "server-only") — importáveis
 * por Client Components. A lógica de dados fica em document-templates.ts.
 */

export const TEMPLATE_TYPES = [
  { value: "nota", label: "Anotação clínica" },
  { value: "receita", label: "Receita" },
  { value: "atestado", label: "Atestado" },
  { value: "geral", label: "Geral" },
] as const;

const LABEL: Record<string, string> = {
  nota: "Anotação clínica",
  receita: "Receita",
  atestado: "Atestado",
  geral: "Geral",
};

export const isValidTemplateType = (s: string): boolean => s in LABEL;
export const templateTypeLabel = (s: string): string => LABEL[s] ?? s;
