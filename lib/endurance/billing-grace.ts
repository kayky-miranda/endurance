/**
 * Carência após falha de pagamento — regra PURA, testável sem banco.
 *
 * O bloqueio por assinatura irregular passou a ser real (toda mutação para).
 * Sem carência, um cartão recusado — validade vencida, limite momentâneo,
 * antifraude do banco — travaria a operação do cliente no mesmo dia, no meio do
 * expediente. Isso não é cobrança, é dano: quem estava pagando não virou
 * inadimplente porque o banco recusou uma transação.
 *
 * A carência vale SÓ para quem já pagava (`pastDueSince` preenchido pelo webhook
 * na transição ativo → atrasado). Teste expirado não entra: ali a carência já
 * foram os 14 dias, e dar mais uma semana seria estender o teste, não perdoar
 * uma falha.
 */

/**
 * Sete dias: cobre um fim de semana prolongado e o tempo de o cliente falar com
 * o banco e trocar o cartão. Menos que isso não cobre quem tenta resolver na
 * segunda; muito mais transforma cobrança em doação.
 */
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

export function graceEndsAt(pastDueSince: Date): Date {
  return new Date(pastDueSince.getTime() + GRACE_DAYS * DAY_MS);
}

/** Ainda dentro da carência? `null` (teste expirado, ou nunca pagou) = não. */
export function inGracePeriod(
  pastDueSince: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!pastDueSince) return false;
  return now.getTime() < graceEndsAt(pastDueSince).getTime();
}

/**
 * Dias inteiros restantes, arredondando PARA CIMA — faltando 4h o cliente lê
 * "1 dia", não "0 dias". Zero quando acabou.
 */
export function graceDaysLeft(
  pastDueSince: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!pastDueSince) return 0;
  const ms = graceEndsAt(pastDueSince).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}
