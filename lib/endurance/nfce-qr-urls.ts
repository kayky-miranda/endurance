/**
 * URLs de consulta do QR Code da NFC-e, por UF e por ambiente — PURO.
 *
 * O QR impresso no cupom leva o consumidor à consulta pública da SEFAZ do
 * estado emissor. Cada UF tem a sua, e a de homologação é diferente da de
 * produção na maioria delas.
 *
 * DOIS PROBLEMAS QUE ISTO RESOLVE:
 *
 * 1. Só 5 estados estavam mapeados. Os outros 22 caíam num fallback
 *    `sefaz.uf.gov.br` — domínio de exemplo, que não existe. O cupom saía com
 *    um QR que não abre em lugar nenhum.
 *
 * 2. A URL não variava por ambiente. SP e MG estavam com o endereço de
 *    HOMOLOGAÇÃO fixo, então uma nota de produção nesses estados levava o
 *    consumidor à consulta de teste — onde a nota dele não existe.
 *
 * Fonte: Portal Nacional da NFC-e (ENCAT), área do desenvolvedor —
 * https://nfce.encat.org/desenvolvedor/qrcode/
 *
 * Onde a SEFAZ publicou transição de endereço, adotamos o VIGENTE e deixamos o
 * anterior anotado, porque é o tipo de coisa que volta a mudar.
 */

export interface QrUrls {
  producao: string;
  homologacao: string;
}

/**
 * Estados em que a SEFAZ usa o MESMO endereço nos dois ambientes — o parâmetro
 * `tpAmb` dentro do QR é o que distingue. Não é engano de cadastro.
 */
const QR_URLS: Record<string, QrUrls> = {
  AC: {
    producao: "http://www.sefaznet.ac.gov.br/nfce/qrcode",
    homologacao: "http://www.hml.sefaznet.ac.gov.br/nfce/qrcode",
  },
  AL: {
    producao: "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp",
    homologacao: "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp",
  },
  AM: {
    producao: "https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp",
    homologacao: "https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp",
  },
  AP: {
    producao: "https://www.sefaz.ap.gov.br/nfce/nfcep.php",
    homologacao: "https://www.sefaz.ap.gov.br/nfcehml/nfce.php",
  },
  BA: {
    producao: "http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx",
    homologacao: "http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx",
  },
  CE: {
    producao: "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html",
    homologacao: "http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html",
  },
  DF: {
    producao: "http://www.fazenda.df.gov.br/nfce/qrcode",
    homologacao: "http://www.fazenda.df.gov.br/nfce/qrcode",
  },
  ES: {
    producao: "http://app.sefaz.es.gov.br/ConsultaNFCe/",
    homologacao: "http://homologacao.sefaz.es.gov.br/ConsultaNFCe/",
  },
  // GO migrou para HTTPS em 16/06/2025 (Informe Técnico 2025.003).
  GO: {
    producao: "https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe",
    homologacao: "https://nfewebhomolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe",
  },
  MA: {
    producao: "https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp",
    homologacao: "https://homologacao.sefaz.ma.gov.br/portal/consultarNFCe.jsp",
  },
  // MG migrou de nfce.fazenda.mg.gov.br para portalsped em 21/03/2022.
  MG: {
    producao: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
    homologacao: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
  },
  MS: {
    producao: "http://www.dfe.ms.gov.br/nfce/qrcode",
    homologacao: "http://www.dfe.ms.gov.br/nfce/qrcode",
  },
  MT: {
    producao: "http://www.sefaz.mt.gov.br/nfce/consultanfce",
    homologacao: "http://homologacao.sefaz.mt.gov.br/nfce/consultanfce",
  },
  PA: {
    producao: "https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam",
    homologacao:
      "https://appnfc.sefa.pa.gov.br/portal-homologacao/view/consultas/nfce/nfceForm.seam",
  },
  PB: {
    producao: "http://www.sefaz.pb.gov.br/nfce",
    homologacao: "http://www.sefaz.pb.gov.br/nfcehom",
  },
  PE: {
    producao: "http://nfce.sefaz.pe.gov.br/nfce/consulta",
    homologacao: "http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta",
  },
  PI: {
    producao: "http://www.sefaz.pi.gov.br/nfce/qrcode",
    homologacao: "http://www.sefaz.pi.gov.br/nfce/qrcode",
  },
  PR: {
    producao: "http://www.fazenda.pr.gov.br/nfce/qrcode",
    homologacao: "http://www.fazenda.pr.gov.br/nfce/qrcode",
  },
  // RJ migrou para consultadfe em 19/12/2023; o endereço www4 saiu em 02/09/2024.
  RJ: {
    producao: "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode",
    homologacao: "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode",
  },
  // RN em transição: o endereço novo vale desde 25/05/2026, o antigo sai em
  // 30/09/2026. Adotado o novo, que já está válido.
  RN: {
    producao: "https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx",
    homologacao: "https://hom.nfce.sefaz.rn.gov.br/consultarNFCe.aspx",
  },
  RO: {
    producao: "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp",
    homologacao: "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp",
  },
  RR: {
    producao: "https://www.sefaz.rr.gov.br/nfce/servlet/qrcode",
    homologacao: "http://200.174.88.103:8080/nfce/servlet/qrcode",
  },
  RS: {
    producao: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
    homologacao: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
  },
  SC: {
    producao: "https://sat.sef.sc.gov.br/nfce/consulta",
    homologacao: "https://hom.sat.sef.sc.gov.br/nfce/consulta",
  },
  SE: {
    producao: "http://www.nfce.se.gov.br/nfce/qrcode",
    homologacao: "http://www.hom.nfe.se.gov.br/nfce/qrcode",
  },
  SP: {
    producao: "https://www.nfce.fazenda.sp.gov.br/qrcode",
    homologacao: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode",
  },
  TO: {
    producao: "http://www.sefaz.to.gov.br/nfce/qrcode",
    homologacao: "http://homologacao.sefaz.to.gov.br/nfce/qrcode",
  },
};

/** Toda UF que emite NFC-e está mapeada — usado em teste de integridade. */
export const UFS_COM_QR = Object.keys(QR_URLS).sort();

/**
 * URL de consulta para a UF e o ambiente. `ambiente` segue o padrão da SEFAZ:
 * "1" produção, "2" homologação.
 *
 * UF desconhecida devolve string vazia, e não um endereço inventado: um QR que
 * aponta para lugar errado é pior do que um QR ausente — o consumidor tenta
 * conferir a nota e conclui que ela é falsa.
 */
export function nfceQrUrl(uf: string, ambiente: string): string {
  const entry = QR_URLS[(uf ?? "").trim().toUpperCase()];
  if (!entry) return "";
  return ambiente === "1" ? entry.producao : entry.homologacao;
}

/** A UF emite NFC-e e tem endereço de consulta conhecido? */
export function hasQrUrl(uf: string): boolean {
  return Boolean(QR_URLS[(uf ?? "").trim().toUpperCase()]);
}
