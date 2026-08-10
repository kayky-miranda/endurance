import { describe, it, expect } from "vitest";
import {
  tributacaoIcms,
  icmsCodigo,
  isValidCfop,
  cfopInterestadual,
  validateTaxConfig,
  ORIGEM_OPTIONS,
  FINALIDADE_OPTIONS,
  PRESENCA_OPTIONS,
  type TaxConfig,
} from "@/lib/endurance/tax-defaults";

const base: TaxConfig = {
  cfopPadrao: "5102",
  icmsOrigem: "0",
  csosn: "102",
  cstIcms: "00",
  pisSituacao: "49",
  cofinsSituacao: "49",
  finalidade: "1",
  consumidorFinal: "1",
  presencaComprador: "1",
};

/**
 * Este módulo NÃO calcula imposto — alíquota e enquadramento são do contador.
 * Ele garante que os códigos enviados sejam estruturalmente coerentes com o
 * regime, que é formato exigido pela SEFAZ, não opinião fiscal.
 */
describe("código de ICMS por regime", () => {
  it("Simples Nacional usa CSOSN; Regime Normal usa CST", () => {
    // É a troca que mais gera rejeição em ERP mal feito: mandar CSOSN para
    // Lucro Presumido derruba a nota inteira, com mensagem que não diz a causa.
    expect(tributacaoIcms("1")).toBe("csosn");
    expect(tributacaoIcms("2")).toBe("csosn");
    expect(tributacaoIcms("3")).toBe("cst");
  });

  it("resolve o código conforme o regime da empresa", () => {
    expect(icmsCodigo("1", base)).toEqual({ tipo: "csosn", codigo: "102" });
    expect(icmsCodigo("3", base)).toEqual({ tipo: "cst", codigo: "00" });
  });

  it("regime desconhecido cai no Simples, que é o caso do público-alvo", () => {
    expect(tributacaoIcms("")).toBe("csosn");
    expect(tributacaoIcms("9")).toBe("csosn");
  });
});

describe("CFOP", () => {
  it("aceita 4 dígitos começando de 1 a 7", () => {
    expect(isValidCfop("5102")).toBe(true);
    expect(isValidCfop("6.102")).toBe(true);
    expect(isValidCfop("102")).toBe(false);
    expect(isValidCfop("8102")).toBe(false);
    expect(isValidCfop("")).toBe(false);
  });

  it("distingue operação dentro do estado da interestadual", () => {
    expect(cfopInterestadual("5102")).toBe(false);
    expect(cfopInterestadual("6102")).toBe(true);
  });
});

describe("coerência da configuração", () => {
  it("configuração padrão do Simples não gera nenhum problema", () => {
    expect(validateTaxConfig(base, "1", "65")).toEqual([]);
  });

  it("CFOP interestadual na NFC-e é BLOQUEIO", () => {
    // O cupom é venda presencial no próprio estado — a SEFAZ recusa.
    const issues = validateTaxConfig({ ...base, cfopPadrao: "6102" }, "1", "65");
    const cfop = issues.find((i) => i.field === "cfopPadrao")!;
    expect(cfop.blocking).toBe(true);
    expect(cfop.message).toMatch(/NF-e/);
  });

  it("mas CFOP interestadual é legítimo na NF-e", () => {
    expect(validateTaxConfig({ ...base, cfopPadrao: "6102" }, "1", "55")).toEqual([]);
  });

  it("CFOP malformado é bloqueio com exemplo na mensagem", () => {
    const issues = validateTaxConfig({ ...base, cfopPadrao: "51" }, "1");
    expect(issues[0].blocking).toBe(true);
    expect(issues[0].message).toMatch(/5102/);
  });

  it("cobra o código do REGIME CERTO, não os dois", () => {
    // Simples sem CSOSN: reclama do CSOSN e ignora o CST vazio.
    const simples = validateTaxConfig({ ...base, csosn: "", cstIcms: "" }, "1");
    expect(simples.some((i) => i.field === "csosn")).toBe(true);
    expect(simples.some((i) => i.field === "cstIcms")).toBe(false);

    // Regime Normal: o inverso.
    const normal = validateTaxConfig({ ...base, csosn: "", cstIcms: "" }, "3");
    expect(normal.some((i) => i.field === "cstIcms")).toBe(true);
    expect(normal.some((i) => i.field === "csosn")).toBe(false);
  });

  it("presença 'não presencial' na NFC-e é AVISO, não bloqueio", () => {
    // Varia por estado; barrar seria decidir no lugar do contador.
    const issues = validateTaxConfig({ ...base, presencaComprador: "9" }, "1", "65");
    const p = issues.find((i) => i.field === "presencaComprador")!;
    expect(p.blocking).toBe(false);
  });

  it("origem da mercadoria é obrigatória", () => {
    const issues = validateTaxConfig({ ...base, icmsOrigem: "" }, "1");
    expect(issues.some((i) => i.field === "icmsOrigem" && i.blocking)).toBe(true);
  });
});

describe("opções da interface", () => {
  it("os valores padrão existem nas listas oferecidas", () => {
    // Um default fora da lista deixaria o select em branco na primeira visita.
    expect(ORIGEM_OPTIONS.some((o) => o.value === base.icmsOrigem)).toBe(true);
    expect(FINALIDADE_OPTIONS.some((o) => o.value === base.finalidade)).toBe(true);
    expect(PRESENCA_OPTIONS.some((o) => o.value === base.presencaComprador)).toBe(true);
  });
});
