/**
 * Documento do PAGADOR (CPF ou CNPJ) — puro, serve cliente e servidor.
 *
 * Por que existe separado do documento fiscal: o gateway exige um CPF/CNPJ para
 * emitir a cobrança, e até aqui o checkout ia buscá-lo em `FiscalConfig` — a
 * aba de configuração de NOTA FISCAL. Isso criava dois problemas:
 *
 *  1. um impasse real: salvar a aba Fiscal exige `fiscal.manage`, que é
 *     bloqueada quando a assinatura vence. O cliente que deixasse o teste
 *     expirar sem ter preenchido a aba ficava preso — não pagava porque não
 *     conseguia cadastrar o documento, e não cadastrava porque não pagava;
 *  2. um erro de modelagem: psicólogo, nutricionista e consultório que emitem
 *     recibo (não NF-e) não têm motivo nenhum para configurar o módulo fiscal.
 *     Exigir isso para assinar é pedir configuração que não serve para nada.
 *
 * Dado de cobrança pertence à cobrança. O fiscal continua sendo do fiscal.
 */

import { isValidCpf } from "./patient";
import { isValidCnpj } from "./cnpj";

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export type DocumentKind = "cpf" | "cnpj" | null;

/** CPF, CNPJ ou nenhum dos dois — decidido pelo TAMANHO, validado pelos dígitos. */
export function documentKind(raw: string): DocumentKind {
  const d = onlyDigits(raw);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

/**
 * Valida de verdade, com dígitos verificadores.
 *
 * O checkout antigo só conferia o COMPRIMENTO (11 ou 14). "00000000000" passava
 * na checagem daqui e era recusado lá no gateway, onde a mensagem de erro não
 * diz ao cliente o que ele digitou errado.
 */
export function isValidBillingDocument(raw: string): boolean {
  const kind = documentKind(raw);
  if (kind === "cpf") return isValidCpf(raw);
  if (kind === "cnpj") return isValidCnpj(raw);
  return false;
}

/** Mensagem única de recusa — a mesma na tela e no servidor. */
export function billingDocumentError(raw: string): string | null {
  const d = onlyDigits(raw);
  if (d.length === 0) return "Informe o CPF ou CNPJ do responsável pela conta.";
  if (documentKind(raw) === null)
    return "O documento deve ter 11 dígitos (CPF) ou 14 (CNPJ).";
  if (!isValidBillingDocument(raw))
    return documentKind(raw) === "cpf" ? "CPF inválido." : "CNPJ inválido.";
  return null;
}

/** Formata para leitura: 000.000.000-00 ou 00.000.000/0000-00. */
export function formatBillingDocument(raw: string): string {
  const d = onlyDigits(raw);
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw;
}
