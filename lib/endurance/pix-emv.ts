/**
 * Pix BR Code (payload "copia e cola") — modelo EMV® MPM do Banco Central.
 *
 * Funções PURAS (sem rede), no mesmo espírito do `fiscal.ts`: montam o payload
 * TLV e o CRC-16/CCITT-FALSE exatamente como o app do banco lê. Usado no modo
 * SIMULADO (gera o BR Code a partir da chave Pix da empresa) e como fallback.
 *
 * Referência: Manual do BR Code (BCB) — campos:
 *   00 Payload Format Indicator | 26 Merchant Account Information (GUI pix)
 *   52 MCC | 53 Moeda (986=BRL) | 54 Valor | 58 País (BR)
 *   59 Nome do recebedor | 60 Cidade | 62 Dados adicionais (05=txid) | 63 CRC
 */

/**
 * Normaliza para ASCII imprimível (EMV é ASCII). O NFD separa o acento em marca
 * combinante (fora do ASCII), então o filtro `[^\x20-\x7e]` já remove o acento.
 */
function ascii(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
}

/** Campo EMV: id (2) + tamanho (2, zero-pad) + valor. */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * CRC-16/CCITT-FALSE (polinômio 0x1021, init 0xFFFF) sobre a string inteira já
 * com o prefixo "6304". Devolve 4 hexadecimais maiúsculos.
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixBrCodeInput {
  /** Chave Pix do recebedor (e-mail, CPF/CNPJ, telefone ou aleatória). */
  pixKey: string;
  /** Nome do recebedor (truncado a 25 — limite EMV do campo 59). */
  nome: string;
  /** Cidade do recebedor (truncada a 15 — limite EMV do campo 60). */
  cidade: string;
  /** Valor da cobrança em reais (2 casas). 0/omitido = BR Code sem valor. */
  valor?: number;
  /** Identificador da transação (txid) — alfanumérico, até 25; "***" se vazio. */
  txid?: string;
}

/**
 * Monta o BR Code estático (chave + valor) pronto para copiar e colar ou virar
 * QR. Determinístico para a mesma entrada (testável).
 */
export function buildPixBrCode(input: PixBrCodeInput): string {
  const key = ascii(input.pixKey);
  const nome = ascii(input.nome || "RECEBEDOR").slice(0, 25) || "RECEBEDOR";
  const cidade = ascii(input.cidade || "SAO PAULO").slice(0, 15) || "SAO PAULO";
  const txid = (ascii(input.txid || "").replace(/[^A-Za-z0-9]/g, "") || "***").slice(0, 25);

  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const addData = tlv("05", txid);

  let payload =
    tlv("00", "01") + // Payload Format Indicator
    tlv("26", mai) + // Merchant Account Information (Pix)
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986"); // Moeda: BRL

  if (input.valor && input.valor > 0) {
    payload += tlv("54", input.valor.toFixed(2));
  }

  payload +=
    tlv("58", "BR") + // País
    tlv("59", nome) + // Nome do recebedor
    tlv("60", cidade) + // Cidade
    tlv("62", addData); // Dados adicionais (txid)

  // CRC: calculado sobre o payload + "6304" e anexado como campo 63.
  const toCheck = payload + "6304";
  return toCheck + crc16ccitt(toCheck);
}

/** Gera um txid válido (alfanumérico, 26..35 não — usamos 32) a partir de uma base. */
export function makeTxid(base: string): string {
  const clean = (base ?? "").replace(/[^A-Za-z0-9]/g, "");
  return (clean + "0".repeat(25)).slice(0, 25);
}
