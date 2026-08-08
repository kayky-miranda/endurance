/**
 * Prazo de cancelamento do documento fiscal — regra PURA, testável sem banco.
 *
 * Quem cancela de verdade é a SEFAZ: passado o prazo, ela recusa o evento. O
 * sistema não sabia disso e não mostrava nada, então o operador só descobria o
 * prazo quando a recusa chegava — em geral com uma mensagem técnica do provedor,
 * já com o cliente na frente do balcão e o produto de volta na mão.
 *
 * O prazo NÃO é bloqueado para documentos reais de propósito: ele varia entre
 * unidades federativas e muda por nota técnica, e um bloqueio nosso a mais
 * impediria um cancelamento que a SEFAZ ainda aceitaria. A autoridade continua
 * sendo ela; aqui só informamos e explicamos a recusa quando ela vem.
 */

/** Modelo 65 = NFC-e (consumidor). Modelo 55 = NF-e. */
export const CANCEL_WINDOW_MINUTES: Record<string, number> = {
  "65": 30, // NFC-e: meia hora na maioria dos estados
  "55": 24 * 60, // NF-e: 24 horas
};

const DEFAULT_WINDOW_MIN = 30;

export function cancelWindowMinutes(modelo: string): number {
  return CANCEL_WINDOW_MINUTES[modelo] ?? DEFAULT_WINDOW_MIN;
}

/** Instante em que o prazo se encerra, contado da AUTORIZAÇÃO. */
export function cancelWindowEndsAt(modelo: string, autorizadaEm: Date): Date {
  return new Date(autorizadaEm.getTime() + cancelWindowMinutes(modelo) * 60_000);
}

export function withinCancelWindow(
  modelo: string,
  autorizadaEm: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  // Sem data de autorização não dá para afirmar que venceu — não inventamos
  // um impedimento a partir de dado ausente.
  if (!autorizadaEm) return true;
  return now.getTime() < cancelWindowEndsAt(modelo, autorizadaEm).getTime();
}

/** Minutos inteiros restantes (0 quando venceu). Arredonda para baixo. */
export function cancelMinutesLeft(
  modelo: string,
  autorizadaEm: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!autorizadaEm) return cancelWindowMinutes(modelo);
  const ms = cancelWindowEndsAt(modelo, autorizadaEm).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 60_000);
}

/** Rótulo do que ainda dá para fazer — o texto que o operador lê na tela. */
export function cancelWindowLabel(
  modelo: string,
  autorizadaEm: Date | null | undefined,
  now: Date = new Date(),
): string {
  const left = cancelMinutesLeft(modelo, autorizadaEm, now);
  if (left <= 0)
    return "Prazo de cancelamento encerrado — a SEFAZ deve recusar. Emita uma nota de devolução.";
  if (left < 60) return `Cancelamento disponível por mais ${left} min`;
  const h = Math.floor(left / 60);
  return `Cancelamento disponível por mais ${h} h`;
}
