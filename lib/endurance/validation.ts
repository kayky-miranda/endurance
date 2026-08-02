/**
 * Validadores genéricos de entrada — PURO (sem "server-only"): serve ao
 * servidor, ao cliente e aos testes. Fonte única para regras que antes viviam
 * repetidas como regex solta em cada módulo.
 */

/**
 * Formato de e-mail — DEFINIÇÃO ÚNICA da regra no sistema. Os schemas Zod
 * (`lib/validation.ts`) e os serviços de domínio (pacientes, fornecedores)
 * consomem daqui, para a mesma entrada nunca ser aceita num lugar e recusada
 * noutro.
 *
 * Deliberadamente permissivo: "algo@algo.dominio", sem espaços. Não tentamos
 * implementar a RFC 5322 — a validação forte de e-mail é a confirmação por
 * mensagem; aqui só barramos o erro de digitação óbvio.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test((raw ?? "").trim());
}
