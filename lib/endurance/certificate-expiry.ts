/**
 * Validade do certificado digital A1 — regra PURA, testável sem banco.
 *
 * O A1 dura 1 ano. No dia seguinte ao vencimento a SEFAZ recusa tudo e o balcão
 * simplesmente para — sem erro anterior, sem aviso, com fila no caixa. É a
 * falha mais previsível de um ERP fiscal e a mais fácil de evitar: o provedor
 * devolve a data de validade no cadastro, então basta olhar para ela.
 *
 * Os avisos começam cedo de propósito. Renovar um A1 não é instantâneo — o
 * cliente precisa acionar o contador ou a certificadora, e às vezes fazer
 * videoconferência de validação. Avisar na véspera não ajuda ninguém.
 */

export type CertificateStatus =
  | "ausente"
  | "vencido"
  | "critico"
  | "atencao"
  | "ok";

/** Dias que disparam cada nível de aviso. */
export const CERT_CRITICAL_DAYS = 7;
export const CERT_WARNING_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Dias inteiros até o vencimento. Negativo quando já venceu.
 * `null` quando não há certificado cadastrado.
 */
export function certDaysLeft(
  validoAte: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!validoAte) return null;
  return Math.floor((validoAte.getTime() - now.getTime()) / DAY_MS);
}

export function certStatus(
  validoAte: Date | null | undefined,
  now: Date = new Date(),
): CertificateStatus {
  const d = certDaysLeft(validoAte, now);
  if (d === null) return "ausente";
  if (d < 0) return "vencido";
  if (d <= CERT_CRITICAL_DAYS) return "critico";
  if (d <= CERT_WARNING_DAYS) return "atencao";
  return "ok";
}

/** O status exige ação do cliente agora? */
export function certNeedsAttention(status: CertificateStatus): boolean {
  return status === "vencido" || status === "critico" || status === "atencao";
}

/**
 * Frase para a tela. Diz o prazo E a consequência — "vence em 5 dias" não
 * comunica urgência para quem não sabe que a emissão para junto.
 */
export function certMessage(
  validoAte: Date | null | undefined,
  now: Date = new Date(),
): string {
  const status = certStatus(validoAte, now);
  const d = certDaysLeft(validoAte, now);

  switch (status) {
    case "ausente":
      return "Nenhum certificado digital enviado. Sem ele não é possível emitir notas fiscais.";
    case "vencido":
      return `Certificado vencido há ${Math.abs(d!)} ${Math.abs(d!) === 1 ? "dia" : "dias"}. A emissão de notas está parada até o envio de um novo.`;
    case "critico":
      return d === 0
        ? "O certificado vence HOJE. Envie o novo para não interromper a emissão."
        : `O certificado vence em ${d} ${d === 1 ? "dia" : "dias"} e a emissão para junto. Providencie a renovação agora.`;
    case "atencao":
      return `O certificado vence em ${d} dias. Vale acionar seu contador — a renovação não é imediata.`;
    case "ok":
      return `Certificado válido por mais ${d} dias.`;
  }
}
