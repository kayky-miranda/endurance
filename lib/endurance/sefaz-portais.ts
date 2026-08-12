/**
 * Onde o contribuinte obtém o CSC — PURO, serve cliente e servidor.
 *
 * O CSC (Código de Segurança do Contribuinte) é obrigatório para NFC-e: é ele
 * que assina o QR Code do cupom. Na simulação do cliente real este foi o ponto
 * onde o dono de mercearia parou: o campo pedia "CSC" e "ID do CSC" sem dizer o
 * que era nem onde conseguir — e não se consegue dentro do ERP, porque cada
 * SEFAZ estadual gera o dela, num portal diferente.
 *
 * Aqui ficam os endereços por UF. Onde não temos o link exato, a orientação
 * continua útil: dizer QUE é no portal da SEFAZ do estado e QUE o contador
 * costuma ter já resolve a dúvida principal.
 */

export interface SefazPortal {
  uf: string;
  /** Portal onde o CSC é gerado/consultado. Vazio = não mapeado. */
  cscUrl: string;
}

const PORTAIS: Record<string, string> = {
  SP: "https://www.nfce.fazenda.sp.gov.br/NFCePortal/Paginas/Home.aspx",
  RJ: "https://www.fazenda.rj.gov.br/nfce",
  MG: "https://www.nfce.fazenda.mg.gov.br",
  PR: "https://www.fazenda.pr.gov.br/servicos/NFC-e",
  RS: "https://www.sefaz.rs.gov.br/NFCE",
  SC: "https://www.sef.sc.gov.br/servicos/servico/122",
  BA: "https://portalnfce.sefaz.ba.gov.br",
  GO: "https://www.economia.go.gov.br/nfce",
  PE: "https://www.sefaz.pe.gov.br/Servicos/NFCe",
  CE: "https://www.sefaz.ce.gov.br/nfce",
  DF: "https://www.receita.fazenda.df.gov.br",
  ES: "https://internet.sefaz.es.gov.br/informacoes/nfce",
  MT: "https://www6.sefaz.mt.gov.br/nfce",
  MS: "https://www.nfce.sefaz.ms.gov.br",
  PA: "https://www.sefa.pa.gov.br/nfce",
  AM: "https://www.sefaz.am.gov.br/nfce",
};

/** URL do portal da SEFAZ da UF, ou vazio quando não mapeada. */
export function sefazCscUrl(uf: string): string {
  return PORTAIS[(uf ?? "").trim().toUpperCase()] ?? "";
}

/**
 * Explicação do CSC para quem nunca ouviu falar. Menciona o contador de
 * propósito: na prática é ele quem costuma ter o código em mãos, e dizer isso
 * poupa o cliente de uma busca que não leva a lugar nenhum.
 */
export function cscHelpText(uf: string): string {
  const u = (uf ?? "").trim().toUpperCase();
  const onde = sefazCscUrl(u)
    ? `no portal da NFC-e da SEFAZ-${u}`
    : "no portal da NFC-e da SEFAZ do seu estado";
  return `Código gerado pela SEFAZ, não pelo ENDURANCE. Obtenha ${onde} ou peça ao seu contador — ele costuma já ter.`;
}
