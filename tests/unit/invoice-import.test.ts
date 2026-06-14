import { describe, it, expect } from "vitest";
import {
  parseInvoiceXml,
  parseInvoiceItems,
} from "@/lib/endurance/invoice-import";

// NF-e (modelo 55) mínima no layout 4.00, com dois itens (um com GTIN e outro
// "SEM GTIN") — cobre a extração de cabeçalho e de itens.
const SAMPLE_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35200614200166000187550010000000071234567890" versao="4.00">
      <ide>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>7</nNF>
        <dhEmi>2026-06-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <xNome>Distribuidora Exemplo LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>A1</cProd>
          <cEAN>7891000100103</cEAN>
          <xProd>Arroz Tipo 1 5kg</xProd>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>22.5000</vUnCom>
          <vProd>225.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>B2</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Feijao Carioca 1kg</xProd>
          <uCom>UN</uCom>
          <qCom>20</qCom>
          <vUnCom>7.0000</vUnCom>
          <vProd>140.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>365.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("parseInvoiceXml", () => {
  it("extrai cabeçalho da NF-e", () => {
    const p = parseInvoiceXml(SAMPLE_NFE);
    expect(p).not.toBeNull();
    expect(p!.chave).toHaveLength(44);
    expect(p!.modelo).toBe("55");
    expect(p!.numero).toBe(7);
    expect(p!.serie).toBe(1);
    expect(p!.emitCnpj).toBe("14200166000187");
    expect(p!.emitNome).toBe("Distribuidora Exemplo LTDA");
    expect(p!.total).toBeCloseTo(365, 2);
    expect(p!.itemsCount).toBe(2);
  });

  it("rejeita XML que não é NF-e", () => {
    expect(parseInvoiceXml("<html></html>")).toBeNull();
    expect(parseInvoiceXml("")).toBeNull();
  });
});

describe("parseInvoiceItems", () => {
  it("extrai itens com e sem GTIN", () => {
    const items = parseInvoiceItems(SAMPLE_NFE);
    expect(items).toHaveLength(2);

    expect(items[0]).toEqual({
      cProd: "A1",
      ean: "7891000100103",
      name: "Arroz Tipo 1 5kg",
      qty: 10,
      unitCost: 22.5,
    });

    // "SEM GTIN" vira string vazia (cai no match por código/nome).
    expect(items[1].ean).toBe("");
    expect(items[1].name).toBe("Feijao Carioca 1kg");
    expect(items[1].qty).toBe(20);
    expect(items[1].unitCost).toBe(7);
  });

  it("retorna lista vazia quando não há itens", () => {
    expect(parseInvoiceItems("<infNFe></infNFe>")).toEqual([]);
  });
});
