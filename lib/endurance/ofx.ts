/**
 * Parser de extrato OFX (Open Financial Exchange) — o formato que todo banco
 * brasileiro exporta ("OFX/Money"). Sem "server-only" nem dependências: é
 * lógica pura, testável, usada pela conciliação bancária.
 *
 * O OFX vem em dois sabores — SGML (tags sem fechamento, o mais comum nos
 * bancos) e XML. Este parser tolera os dois lendo o valor entre uma tag e o
 * próximo delimitador (`<` ou fim de linha), então não depende de `</TAG>`.
 */

export interface OfxTransaction {
  /** FITID: identificador único da transação no banco (idempotência). */
  fitid: string;
  /** Valor COM SINAL: crédito (entrada) positivo, débito (saída) negativo. */
  amount: number;
  /** Data do lançamento (só a data importa para a conciliação). */
  date: Date;
  /** Descrição (MEMO/NAME) — usada como pista na revisão. */
  memo: string;
  type: string; // CREDIT | DEBIT | PIX | TED | ...
}

export interface OfxStatement {
  bankId: string;
  accountId: string;
  transactions: OfxTransaction[];
}

/** Lê o valor de uma tag SGML/XML: `<TAG>valor` até `<` ou quebra de linha. */
function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([^<\r\n]*)`, "i").exec(block);
  return m ? m[1].trim() : "";
}

/** DTPOSTED: AAAAMMDD[HHMMSS][.xxx][fuso] → Date (usa só a data). */
function parseOfxDate(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valor OFX: aceita vírgula ou ponto decimal e sinal. */
function parseOfxAmount(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function parseOfx(content: string): OfxStatement {
  // Normaliza e isola o corpo (ignora o cabeçalho OFX antes de <OFX>).
  const body = content.replace(/\r/g, "");
  const bankId = tag(body, "BANKID");
  const accountId = tag(body, "ACCTID");

  const transactions: OfxTransaction[] = [];
  const seen = new Set<string>();
  // Cada lançamento vive num bloco <STMTTRN> … </STMTTRN> (ou até o próximo).
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const block = m[1];
    const amount = parseOfxAmount(tag(block, "TRNAMT"));
    const date = parseOfxDate(tag(block, "DTPOSTED"));
    if (!Number.isFinite(amount) || !date) continue;
    // FITID pode faltar em extratos ruins — sintetiza uma chave estável.
    const fitid =
      tag(block, "FITID") || `${date.toISOString().slice(0, 10)}:${amount}:${tag(block, "MEMO")}`;
    if (seen.has(fitid)) continue; // dedup dentro do próprio arquivo
    seen.add(fitid);
    transactions.push({
      fitid,
      amount,
      date,
      memo: tag(block, "MEMO") || tag(block, "NAME"),
      type: (tag(block, "TRNTYPE") || (amount >= 0 ? "CREDIT" : "DEBIT")).toUpperCase(),
    });
  }

  return { bankId, accountId, transactions };
}
