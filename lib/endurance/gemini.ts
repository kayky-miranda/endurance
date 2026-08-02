/**
 * Configuração compartilhada do provedor de IA — PURO (importável do servidor e
 * dos testes). Antes esta lista estava COPIADA em dez módulos: quando um id de
 * modelo quebrava, era preciso caçar todas as cópias — foi exatamente o que
 * aconteceu com `gemini-flash-latest`.
 */

/**
 * Ordem de tentativa. O primeiro é o de melhor qualidade; os seguintes existem
 * porque a cota do free tier estoura por modelo, então cair para o próximo
 * mantém o recurso de pé.
 *
 * REMOVIDO `gemini-flash-latest`: responde 400 INVALID_ARGUMENT para chamadas
 * com saída estruturada/streaming — como não é erro "de tentar de novo", ele
 * derrubava a cadeia inteira em vez de deixar o próximo modelo atender.
 * `gemini-2.5-flash-lite` entrou no lugar: funciona e é o mais rápido medido.
 */
export const GEMINI_MODELS: string[] = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

/**
 * Descobre o código real do erro do provedor.
 *
 * ATENÇÃO: o SDK às vezes ENVELOPA a resposta — o código verdadeiro aparece
 * dentro da mensagem (com as aspas escapadas), enquanto o `status` externo traz
 * outra coisa. Olhar só o `status` fazia o laço desistir cedo e transformar
 * "cota estourada" em "falha genérica".
 */
export function providerErrorCode(e: unknown): number {
  const err = e as { status?: number; message?: string } | null;
  const msg = err?.message ?? "";
  // O código de DENTRO da mensagem é o autoritativo: é o corpo devolvido pela
  // API. O `status` externo é o do envelope do SDK e pode discordar (já vimos
  // 429 de cota chegar embrulhado como 400). Aceita a forma escapada
  // (\"code\": 429), que é como o texto vem aninhado.
  const inner = /\\?"code\\?"\s*:\s*(\d{3})/.exec(msg);
  if (inner) return Number(inner[1]);
  if (/RESOURCE_EXHAUSTED|quota/i.test(msg)) return 429;
  return typeof err?.status === "number" ? err.status : 0;
}

/** Erros em que vale tentar o próximo modelo da lista. */
export const RETRYABLE_CODES = new Set([404, 429, 500, 503]);

export function isRetryableError(e: unknown): boolean {
  return RETRYABLE_CODES.has(providerErrorCode(e));
}

export function isQuotaError(e: unknown): boolean {
  return providerErrorCode(e) === 429;
}
