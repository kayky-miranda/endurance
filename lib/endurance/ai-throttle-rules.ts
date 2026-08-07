/**
 * Regra do processamento prioritário — PURA, para ser testável sem banco.
 */

/**
 * Quantas vezes o limite de rajada da IA cresce para quem tem
 * `priority.processing`.
 *
 * 3× foi escolhido para ser sentido sem virar porta aberta: o limite existe
 * para conter automação acidental e rajada de script, e esse propósito precisa
 * sobreviver ao plano mais caro. Um multiplicador alto demais transformaria a
 * capacidade em "sem limite", que é outra promessa — e uma que não queremos
 * fazer sem ter fila de verdade.
 */
export const PRIORITY_MULTIPLIER = 3;

/** Limite efetivo de um recurso de IA para a organização. */
export function effectiveAiLimit(baseLimit: number, hasPriority: boolean): number {
  return hasPriority ? baseLimit * PRIORITY_MULTIPLIER : baseLimit;
}
