import "server-only";
import { hit, type RateVerdict } from "@/lib/rate-limit";
import { checkPlanFeature } from "./plan-limits";
import { PRIORITY_MULTIPLIER } from "./ai-throttle-rules";

/**
 * Limite de rajada dos recursos de IA, com folga maior para quem tem
 * `priority.processing`.
 *
 * POR QUE ASSIM, E NÃO UMA FILA: a capacidade era vendida como "sua fila de IA
 * e relatórios na frente" e não havia fila nenhuma — as chamadas vão direto ao
 * provedor. Construir um enfileirador para justificar a frase seria inventar
 * infraestrutura que ninguém precisa (não há disputa por recurso) e ainda
 * ADICIONARIA latência a todo mundo.
 *
 * O que existe de verdade e incomoda de verdade é o limite de rajada: quem usa
 * IA de forma intensa bate em "Muitas análises seguidas. Aguarde um instante."
 * Dar folga maior a quem paga pelo processamento prioritário é a mesma promessa
 * — passar na frente do limite — entregue sobre um mecanismo que já opera.
 *
 * Não substitui os CRÉDITOS: crédito é volume no ciclo, isto é ritmo por
 * minuto. São dois limites com propósitos diferentes.
 */
export async function hitAi(
  orgId: string,
  key: string,
  baseLimit: number,
  windowMs: number,
): Promise<RateVerdict> {
  const priority = await checkPlanFeature(orgId, "priority.processing");
  const limit = priority.ok ? baseLimit * PRIORITY_MULTIPLIER : baseLimit;
  return hit(key, limit, windowMs);
}
