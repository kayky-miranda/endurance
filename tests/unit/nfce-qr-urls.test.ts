import { describe, it, expect } from "vitest";
import { UFS_COM_QR, nfceQrUrl, hasQrUrl } from "@/lib/endurance/nfce-qr-urls";

/**
 * O QR do cupom leva o consumidor à consulta pública da SEFAZ do estado
 * emissor. Antes só 5 UFs estavam mapeadas e o endereço não variava por
 * ambiente — uma nota de produção em SP mandava o consumidor para a consulta de
 * homologação, onde a nota dele não existe.
 */

const TODAS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

describe("URLs de consulta do QR Code", () => {
  it("cobre as 27 unidades federativas", () => {
    expect(UFS_COM_QR).toHaveLength(27);
    for (const uf of TODAS) expect(hasQrUrl(uf), uf).toBe(true);
  });

  it("toda URL é absoluta e sem query — os parâmetros são montados depois", () => {
    for (const uf of TODAS) {
      for (const amb of ["1", "2"]) {
        const url = nfceQrUrl(uf, amb);
        expect(url, `${uf}/${amb}`).toMatch(/^https?:\/\//);
        expect(url, `${uf}/${amb}`).not.toContain("?");
      }
    }
  });

  it("distingue PRODUÇÃO de HOMOLOGAÇÃO onde a SEFAZ usa endereços diferentes", () => {
    // SP era o caso do bug: a tabela antiga tinha só o de homologação.
    expect(nfceQrUrl("SP", "1")).not.toContain("homologacao");
    expect(nfceQrUrl("SP", "2")).toContain("homologacao");
    expect(nfceQrUrl("SP", "1")).not.toBe(nfceQrUrl("SP", "2"));
    expect(nfceQrUrl("BA", "1")).not.toBe(nfceQrUrl("BA", "2"));
    expect(nfceQrUrl("CE", "1")).not.toBe(nfceQrUrl("CE", "2"));
  });

  it("aceita o mesmo endereço nos dois ambientes onde a SEFAZ assim publica", () => {
    // Não é engano de cadastro: o tpAmb dentro do QR é que distingue.
    for (const uf of ["DF", "MS", "PR", "PI", "RS", "RO", "MG", "RJ", "AL"]) {
      expect(nfceQrUrl(uf, "1"), uf).toBe(nfceQrUrl(uf, "2"));
    }
  });

  it("usa os endereços VIGENTES onde houve migração", () => {
    // GO migrou para HTTPS em 2025; MG saiu de nfce.fazenda para portalsped;
    // RJ passou a consultadfe. Manter o antigo geraria QR que não abre.
    expect(nfceQrUrl("GO", "1")).toContain("nfeweb.sefaz.go.gov.br");
    expect(nfceQrUrl("MG", "1")).toContain("portalsped");
    expect(nfceQrUrl("RJ", "1")).toContain("consultadfe");
    expect(nfceQrUrl("RN", "1")).toContain("nfce.sefaz.rn.gov.br");
  });

  it("UF desconhecida devolve VAZIO em vez de endereço inventado", () => {
    // Um QR que aponta para o lugar errado é pior do que um QR ausente: o
    // consumidor confere, não acha a nota e conclui que ela é falsa.
    expect(nfceQrUrl("ZZ", "1")).toBe("");
    expect(nfceQrUrl("", "1")).toBe("");
    expect(hasQrUrl("ZZ")).toBe(false);
  });

  it("normaliza a sigla", () => {
    expect(nfceQrUrl("sp", "1")).toBe(nfceQrUrl("SP", "1"));
    expect(nfceQrUrl(" sp ", "1")).toBe(nfceQrUrl("SP", "1"));
  });

  it("ambiente diferente de 1 cai em homologação — o lado seguro", () => {
    expect(nfceQrUrl("SP", "")).toBe(nfceQrUrl("SP", "2"));
    expect(nfceQrUrl("SP", "9")).toBe(nfceQrUrl("SP", "2"));
  });
});
