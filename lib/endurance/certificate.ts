/**
 * Constantes PURAS do atestado (sem banco, sem "server-only") — seguras para
 * importar em Client Components. A lógica de dados fica em certificates.ts.
 */

export const CERTIFICATE_KINDS = [
  { value: "afastamento", label: "Afastamento" },
  { value: "comparecimento", label: "Comparecimento" },
  { value: "outro", label: "Outro" },
] as const;

const KIND_LABEL: Record<string, string> = {
  afastamento: "Afastamento",
  comparecimento: "Comparecimento",
  outro: "Outro",
};

export const isValidCertificateKind = (s: string): boolean => s in KIND_LABEL;
export const certificateKindLabel = (s: string): string => KIND_LABEL[s] ?? s;
