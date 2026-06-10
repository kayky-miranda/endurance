import "server-only";
import crypto from "crypto";

/**
 * Camada fiscal — NFC-e (Nota Fiscal de Consumidor Eletrônica, modelo 65).
 *
 * O que é REAL aqui (segue o layout oficial da SEFAZ / NT 2015.002):
 *  - Chave de acesso de 44 dígitos + dígito verificador (módulo 11).
 *  - QR Code versão 2.00 "online" com hash SHA-1 sobre o CSC.
 *  - XML estruturado conforme o leiaute 4.00 (infNFe: ide/emit/det/total/pag).
 *
 * O que é SIMULADO (exige certificado digital A1/A3 + webservice da SEFAZ, que
 * não temos no protótipo): a assinatura digital XML-DSig e a autorização real.
 * Geramos um protocolo e marcamos como autorizada. A arquitetura está pronta
 * para plugar um provedor (ex.: Focus NFe, NFe.io, PlugNotas) trocando só a
 * função de transmissão.
 */

// Códigos de UF do IBGE (cUF) — usados no início da chave de acesso.
const UF_CODE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

// URL de consulta do QR Code por UF (ambiente de homologação quando aplicável).
const QR_URL: Record<string, string> = {
  SP: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode",
  RJ: "https://www4.fazenda.rj.gov.br/consultaNFCe/QRCode",
  MG: "https://hnfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
  PR: "http://www.fazenda.pr.gov.br/nfce/qrcode",
  RS: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
};
const QR_URL_FALLBACK = "https://www.sefaz.uf.gov.br/nfce/qrcode";

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");
const pad = (v: string | number, n: number) =>
  String(v).replace(/\D/g, "").padStart(n, "0").slice(-n);

/** Dígito verificador da chave de acesso (módulo 11, pesos 2..9 cíclicos). */
export function chaveDV(chave43: string): string {
  let peso = 2;
  let soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return String(dv >= 10 ? 0 : dv);
}

export interface AccessKeyParts {
  uf: string;
  cnpj: string;
  modelo: string; // "65"
  serie: number;
  numero: number;
  emissao: Date;
  tpEmis?: string; // 1 = normal
  cNF?: string; // código numérico (8 díg.)
}

/** Monta a chave de acesso de 44 dígitos (43 + DV). */
export function buildAccessKey(p: AccessKeyParts): string {
  const cUF = UF_CODE[p.uf] ?? "35";
  const aamm =
    String(p.emissao.getFullYear()).slice(-2) +
    pad(p.emissao.getMonth() + 1, 2);
  const cnpj = pad(p.cnpj || "0", 14);
  const mod = pad(p.modelo || "65", 2);
  const serie = pad(p.serie, 3);
  const nNF = pad(p.numero, 9);
  const tpEmis = pad(p.tpEmis ?? "1", 1);
  const cNF = pad(p.cNF ?? randomCNF(), 8);
  const base = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  return base + chaveDV(base);
}

export function randomCNF(): string {
  return pad(crypto.randomInt(0, 100_000_000), 8);
}

export function formatChave(chave: string): string {
  return (chave.match(/.{1,4}/g) ?? [chave]).join(" ");
}

/**
 * QR Code NFC-e versão 2.00 (modo online). O hash é SHA-1 sobre a string de
 * parâmetros concatenada ao CSC, conforme NT 2015.002.
 *   p = chNFe|2|tpAmb|cIdToken|cHashQRCode
 */
export function buildQrCode(opts: {
  chave: string;
  uf: string;
  ambiente: string; // 1 | 2
  cscId: string;
  csc: string;
}): string {
  const dados = `${opts.chave}|2|${opts.ambiente}|${pad(opts.cscId, 6)}`;
  const hash = crypto
    .createHash("sha1")
    .update(dados + (opts.csc ?? ""))
    .digest("hex")
    .toUpperCase();
  const url = QR_URL[opts.uf] ?? QR_URL_FALLBACK;
  return `${url}?p=${dados}|${hash}`;
}

/** Protocolo de autorização simulado (UF + ano + 13 dígitos). */
export function buildProtocolo(uf: string, emissao: Date): string {
  const cUF = UF_CODE[uf] ?? "35";
  const ano = emissao.getFullYear();
  const seq = pad(crypto.randomInt(0, 1_000_000_000_000), 12);
  return `${cUF}${ano}${seq}`;
}

const esc = (s: string) =>
  (s ?? "").replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );
const num = (n: number, d = 2) => n.toFixed(d);

const PAG_TPAG: Record<string, string> = {
  dinheiro: "01",
  credito: "03",
  debito: "04",
  pix: "17",
};

export interface XmlInput {
  chave: string;
  ambiente: string;
  serie: number;
  numero: number;
  emissao: Date;
  emit: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    ie: string;
    crt: string;
    uf: string;
    municipio: string;
    cMun: string;
  };
  dest?: { nome: string; doc: string } | null;
  itens: { nome: string; quantidade: number; valorUnit: number; codigo: string }[];
  subtotal: number;
  desconto: number;
  total: number;
  pagamentos: { metodo: string; valor: number }[];
}

/** XML da NFC-e (leiaute 4.00, simplificado e não assinado — demonstração). */
export function buildNfceXml(i: XmlInput): string {
  const cUF = UF_CODE[i.emit.uf] ?? "35";
  const id = i.chave;
  const dh = i.emissao.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const det = i.itens
    .map((it, idx) => {
      const vProd = it.quantidade * it.valorUnit;
      return `    <det nItem="${idx + 1}">
      <prod>
        <cProd>${esc(it.codigo || String(idx + 1))}</cProd>
        <xProd>${esc(it.nome)}</xProd>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>${num(it.quantidade, 4)}</qCom>
        <vUnCom>${num(it.valorUnit, 2)}</vUnCom>
        <vProd>${num(vProd, 2)}</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>
      </imposto>
    </det>`;
    })
    .join("\n");
  const pag = i.pagamentos
    .map(
      (p) => `      <detPag><tPag>${PAG_TPAG[p.metodo] ?? "99"}</tPag><vPag>${num(p.valor, 2)}</vPag></detPag>`,
    )
    .join("\n");
  const dest = i.dest?.doc
    ? `    <dest><CPF>${onlyDigits(i.dest.doc)}</CPF><xNome>${esc(i.dest.nome)}</xNome></dest>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${id}">
    <ide>
      <cUF>${cUF}</cUF>
      <natOp>Venda ao consumidor</natOp>
      <mod>65</mod>
      <serie>${i.serie}</serie>
      <nNF>${i.numero}</nNF>
      <dhEmi>${dh}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${esc(i.emit.cMun || "3509502")}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <tpAmb>${i.ambiente}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
    </ide>
    <emit>
      <CNPJ>${onlyDigits(i.emit.cnpj)}</CNPJ>
      <xNome>${esc(i.emit.razaoSocial)}</xNome>
      <xFant>${esc(i.emit.nomeFantasia)}</xFant>
      <enderEmit>
        <xMun>${esc(i.emit.municipio)}</xMun>
        <UF>${esc(i.emit.uf)}</UF>
      </enderEmit>
      <IE>${onlyDigits(i.emit.ie)}</IE>
      <CRT>${esc(i.emit.crt)}</CRT>
    </emit>
${dest}    <detalhes>
${det}
    </detalhes>
    <total>
      <ICMSTot>
        <vProd>${num(i.subtotal, 2)}</vProd>
        <vDesc>${num(i.desconto, 2)}</vDesc>
        <vNF>${num(i.total, 2)}</vNF>
      </ICMSTot>
    </total>
    <pag>
${pag}
    </pag>
  </infNFe>
</NFe>`;
}
