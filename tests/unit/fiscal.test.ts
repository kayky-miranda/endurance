import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildAccessKey,
  buildNfceXml,
  buildProtocolo,
  buildQrCode,
  chaveDV,
  formatChave,
  randomCNF,
  type XmlInput,
} from "@/lib/endurance/fiscal";

describe("chaveDV (módulo 11)", () => {
  it("calcula o DV com pesos 2..9 cíclicos a partir do último dígito", () => {
    // Soma = 1×2 = 2 → resto 2 → DV = 11 − 2 = 9.
    expect(chaveDV("0".repeat(42) + "1")).toBe("9");
  });

  it("DV 10 ou 11 vira 0 (chave toda zero: resto 0 → 11 − 0 = 11 → 0)", () => {
    expect(chaveDV("0".repeat(43))).toBe("0");
  });
});

describe("buildAccessKey", () => {
  const parts = {
    uf: "SP",
    cnpj: "12.345.678/0001-95",
    modelo: "65",
    serie: 1,
    numero: 123,
    emissao: new Date(2026, 5, 15), // junho/2026
    cNF: "12345678",
  };

  it("monta os 44 dígitos no layout cUF|AAMM|CNPJ|mod|série|nNF|tpEmis|cNF|DV", () => {
    const chave = buildAccessKey(parts);
    expect(chave).toMatch(/^\d{44}$/);
    expect(chave.slice(0, 2)).toBe("35"); // SP
    expect(chave.slice(2, 6)).toBe("2606"); // AA=26, MM=06
    expect(chave.slice(6, 20)).toBe("12345678000195"); // CNPJ sem máscara
    expect(chave.slice(20, 22)).toBe("65");
    expect(chave.slice(22, 25)).toBe("001");
    expect(chave.slice(25, 34)).toBe("000000123");
    expect(chave.slice(34, 35)).toBe("1"); // tpEmis normal
    expect(chave.slice(35, 43)).toBe("12345678");
  });

  it("fecha com o DV calculado sobre os 43 primeiros dígitos", () => {
    const chave = buildAccessKey(parts);
    expect(chave.slice(43)).toBe(chaveDV(chave.slice(0, 43)));
  });

  it("é determinística para os mesmos parâmetros (com cNF fixo)", () => {
    expect(buildAccessKey(parts)).toBe(buildAccessKey(parts));
  });
});

describe("randomCNF / buildProtocolo", () => {
  it("cNF tem sempre 8 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(randomCNF()).toMatch(/^\d{8}$/);
  });

  it("protocolo = cUF + ano + 12 dígitos", () => {
    const p = buildProtocolo("SP", new Date(2026, 0, 1));
    expect(p).toMatch(/^352026\d{12}$/);
  });
});

describe("buildQrCode (NT 2015.002, versão 2.00)", () => {
  it("gera p=chave|2|ambiente|cscId|hash com SHA-1 sobre dados+CSC", () => {
    const chave = "1".repeat(44);
    const qr = buildQrCode({
      chave,
      uf: "SP",
      ambiente: "2",
      cscId: "1",
      csc: "MEU-CSC-SECRETO",
    });
    const dados = `${chave}|2|2|000001`; // cscId com 6 dígitos
    const hash = crypto
      .createHash("sha1")
      .update(dados + "MEU-CSC-SECRETO")
      .digest("hex")
      .toUpperCase();
    expect(qr).toBe(
      `https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${dados}|${hash}`,
    );
  });

  it("UF sem URL própria usa o fallback", () => {
    const qr = buildQrCode({
      chave: "1".repeat(44),
      uf: "AC",
      ambiente: "1",
      cscId: "1",
      csc: "",
    });
    expect(qr.startsWith("https://www.sefaz.uf.gov.br/nfce/qrcode?p=")).toBe(true);
  });
});

describe("buildNfceXml (leiaute 4.00)", () => {
  const base: XmlInput = {
    chave: "3".repeat(44),
    ambiente: "2",
    serie: 1,
    numero: 42,
    emissao: new Date(Date.UTC(2026, 5, 15, 12, 0, 0)),
    emit: {
      cnpj: "12.345.678/0001-95",
      razaoSocial: "Mercado & Cia <Ltda>",
      nomeFantasia: "Mercadinho",
      ie: "123.456.789",
      crt: "1",
      uf: "SP",
      municipio: "Campinas",
      cMun: "3509502",
    },
    dest: null,
    itens: [
      { nome: "Café 500g", quantidade: 2, valorUnit: 10, codigo: "P1" },
      { nome: 'Açúcar "extra"', quantidade: 1, valorUnit: 5.5, codigo: "" },
    ],
    subtotal: 25.5,
    desconto: 0.5,
    total: 25,
    pagamentos: [
      { metodo: "dinheiro", valor: 20 },
      { metodo: "pix", valor: 5 },
    ],
  };

  it("escapa caracteres especiais e remove máscaras de CNPJ/IE", () => {
    const xml = buildNfceXml(base);
    expect(xml).toContain("Mercado &amp; Cia &lt;Ltda&gt;");
    expect(xml).toContain("Açúcar &quot;extra&quot;");
    expect(xml).toContain("<CNPJ>12345678000195</CNPJ>");
    expect(xml).toContain("<IE>123456789</IE>");
  });

  it("calcula vProd por item e fecha os totais com 2 casas", () => {
    const xml = buildNfceXml(base);
    expect(xml).toContain("<vProd>20.00</vProd>"); // 2 × 10,00
    expect(xml).toContain("<vProd>5.50</vProd>");
    expect(xml).toContain("<vProd>25.50</vProd>"); // ICMSTot
    expect(xml).toContain("<vDesc>0.50</vDesc>");
    expect(xml).toContain("<vNF>25.00</vNF>");
  });

  it("mapeia formas de pagamento para tPag oficial (99 para desconhecidas)", () => {
    const xml = buildNfceXml({
      ...base,
      pagamentos: [
        { metodo: "dinheiro", valor: 1 },
        { metodo: "credito", valor: 1 },
        { metodo: "debito", valor: 1 },
        { metodo: "pix", valor: 1 },
        { metodo: "fiado", valor: 1 },
      ],
    });
    for (const t of ["01", "03", "04", "17", "99"]) {
      expect(xml).toContain(`<tPag>${t}</tPag>`);
    }
  });

  it("inclui o destinatário só quando há documento (CPF sem máscara)", () => {
    const sem = buildNfceXml(base);
    expect(sem).not.toContain("<dest>");
    const com = buildNfceXml({
      ...base,
      dest: { nome: "João da Silva", doc: "123.456.789-09" },
    });
    expect(com).toContain("<CPF>12345678909</CPF>");
    expect(com).toContain("<xNome>João da Silva</xNome>");
  });

  it("identifica a nota pela chave e pelo modelo 65", () => {
    const xml = buildNfceXml(base);
    expect(xml).toContain(`Id="NFe${"3".repeat(44)}"`);
    expect(xml).toContain("<mod>65</mod>");
    expect(xml).toContain("<nNF>42</nNF>");
  });
});

describe("formatChave", () => {
  it("agrupa a chave em blocos de 4 dígitos", () => {
    expect(formatChave("12345678")).toBe("1234 5678");
    expect(formatChave("1".repeat(44)).split(" ")).toHaveLength(11);
  });
});
