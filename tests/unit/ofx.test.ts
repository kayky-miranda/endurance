import { describe, it, expect } from "vitest";
import { parseOfx } from "@/lib/endurance/ofx";

/** Extrato SGML típico de banco BR (tags sem fechamento). */
const SGML = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>001<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260610120000[-03:EST]
<TRNAMT>150.00
<FITID>A1
<MEMO>Recebimento venda #0001
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260611
<TRNAMT>-89,90
<FITID>A2
<NAME>Fornecedor XYZ
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("parseOfx", () => {
  it("extrai conta, banco e transações do SGML", () => {
    const st = parseOfx(SGML);
    expect(st.bankId).toBe("001");
    expect(st.accountId).toBe("12345-6");
    expect(st.transactions).toHaveLength(2);
  });

  it("lê valor com sinal (crédito e débito) e vírgula decimal", () => {
    const [c, d] = parseOfx(SGML).transactions;
    expect(c.amount).toBe(150);
    expect(d.amount).toBe(-89.9);
  });

  it("lê a data ignorando hora e fuso", () => {
    const [c] = parseOfx(SGML).transactions;
    expect(c.date.getFullYear()).toBe(2026);
    expect(c.date.getMonth()).toBe(5); // junho
    expect(c.date.getDate()).toBe(10);
  });

  it("usa MEMO ou NAME como descrição", () => {
    const [c, d] = parseOfx(SGML).transactions;
    expect(c.memo).toContain("venda");
    expect(d.memo).toBe("Fornecedor XYZ");
  });

  it("deduplica transações com o mesmo FITID", () => {
    const dup = SGML.replace("</OFX>", `<STMTTRN><DTPOSTED>20260610<TRNAMT>150.00<FITID>A1</STMTTRN></OFX>`);
    expect(parseOfx(dup).transactions).toHaveLength(2);
  });

  it("sintetiza FITID estável quando o banco não envia", () => {
    const noFit = `<OFX><STMTTRN><DTPOSTED>20260601<TRNAMT>10.00<MEMO>X</STMTTRN></OFX>`;
    const t = parseOfx(noFit).transactions[0];
    expect(t.fitid).toBeTruthy();
    // determinístico: reparsear dá o mesmo id
    expect(parseOfx(noFit).transactions[0].fitid).toBe(t.fitid);
  });

  it("ignora blocos sem valor ou sem data", () => {
    const bad = `<OFX><STMTTRN><MEMO>sem valor</STMTTRN><STMTTRN><TRNAMT>5<DTPOSTED>20260601<FITID>Z</STMTTRN></OFX>`;
    expect(parseOfx(bad).transactions).toHaveLength(1);
  });
});
