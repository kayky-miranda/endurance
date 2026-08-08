/**
 * Quem pode ser destinatário de uma NFC-e — regra PURA, testável sem banco.
 *
 * A NFC-e é documento de venda ao CONSUMIDOR. Desde janeiro de 2026 a SEFAZ
 * recusa NFC-e com destinatário pessoa jurídica (São Paulo já rejeitava antes,
 * para grandes emissores); venda para CNPJ tem que sair como NF-e (modelo 55).
 *
 * Sem esta checagem a nota era montada e transmitida assim mesmo — e pior, o
 * CNPJ ia no campo `cpf_destinatario` do provedor. O operador só descobriria
 * pela rejeição, com o cliente esperando no balcão.
 *
 * Bloquear aqui é a escolha conservadora: o modo de falha de NÃO bloquear é uma
 * nota recusada na hora da venda; o de bloquear é o operador ser mandado para a
 * NF-e, que é exatamente o caminho correto. Trocar o modelo sozinho seria pior
 * — a NF-e exige endereço completo do destinatário e CFOP conforme o estado,
 * que a venda de balcão não coleta.
 */

const digits = (s: string) => (s ?? "").replace(/\D/g, "");

export type DestinatarioKind = "ausente" | "cpf" | "cnpj" | "invalido";

export function destinatarioKind(doc: string | null | undefined): DestinatarioKind {
  const d = digits(doc ?? "");
  if (d.length === 0) return "ausente";
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return "invalido";
}

export interface DestinatarioVerdict {
  ok: boolean;
  kind: DestinatarioKind;
  error?: string;
}

/**
 * A NFC-e aceita este destinatário?
 *
 * Consumidor sem documento é o caso mais comum e é válido — NFC-e não exige
 * identificação do comprador.
 */
export function checkNfceDestinatario(
  doc: string | null | undefined,
): DestinatarioVerdict {
  const kind = destinatarioKind(doc);

  if (kind === "cnpj")
    return {
      ok: false,
      kind,
      error:
        "A NFC-e não pode ser emitida para cliente com CNPJ — a SEFAZ recusa. " +
        "Para venda a pessoa jurídica, emita uma NF-e (modelo 55) pelo módulo de NF-e.",
    };

  if (kind === "invalido")
    return {
      ok: false,
      kind,
      error:
        "O documento do cliente não é um CPF (11 dígitos) nem um CNPJ (14). " +
        "Corrija o cadastro ou emita a nota sem identificar o consumidor.",
    };

  return { ok: true, kind };
}
