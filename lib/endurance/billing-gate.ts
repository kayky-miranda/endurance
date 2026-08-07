/**
 * Regra de bloqueio por assinatura — PURA, para ser testável sem banco.
 *
 * A pergunta que ela responde: com a assinatura vencida, cancelada ou com o
 * teste encerrado, esta permissão ainda vale?
 *
 * Fica separada de `requirePermission` de propósito: é uma decisão comercial
 * com exceções que precisam ser justificadas uma a uma, e enterrá-la dentro do
 * gate de autenticação faria a lista mudar sem ninguém perceber.
 */

/**
 * Permissões que continuam valendo com a assinatura irregular.
 *
 * Cada exceção existe por um motivo que se sustenta sozinho:
 *
 *  - `subscription.manage`: sem ela o cliente ficaria impedido de PAGAR, e o
 *    bloqueio comercial se voltaria contra a própria cobrança;
 *  - `settings.general`: é onde se corrige cadastro e dados de contato —
 *    inclusive os dados que a cobrança usa;
 *  - `reports.export`: os dados são do cliente. Prender o que é dele gera
 *    processo, não pagamento.
 */
export const ALLOWED_WHEN_DELINQUENT: ReadonlySet<string> = new Set([
  "subscription.manage",
  "settings.general",
  "reports.export",
]);

/** A permissão sobrevive a uma assinatura irregular? */
export function allowedWhenDelinquent(permId: string): boolean {
  return ALLOWED_WHEN_DELINQUENT.has(permId);
}
