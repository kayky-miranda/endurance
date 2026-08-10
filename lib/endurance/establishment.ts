import "server-only";
import { prisma } from "@/lib/db";
import { ensureFiscalConfig, getFiscalReadiness } from "./fiscal-service";
import { computeSteps, completionPercent, firstIncompleteStep } from "./establishment-steps";

/**
 * Cadastro do estabelecimento: leitura e gravação por ETAPA.
 *
 * Gravar por etapa (e não o formulário inteiro) é o que permite o cliente
 * parar no meio e voltar depois — que é o comportamento real de quem precisa
 * pedir um dado ao contador. Salvar tudo de uma vez obrigaria a preencher sete
 * telas antes de guardar qualquer coisa.
 */

export interface EstablishmentView {
  // Empresa
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  ie: string;
  inscricaoMunicipal: string;
  cnaePrincipal: string;
  cnaeSecundarios: string;
  naturezaJuridica: string;
  porte: string;
  dataAbertura: string | null;
  situacaoCadastral: string;
  email: string;
  telefone: string;
  site: string;
  respNome: string;
  respCpf: string;
  respEmail: string;
  respTelefone: string;
  respCargo: string;
  // Endereço
  cep: string;
  logradouro: string;
  numeroEnd: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cMun: string;
  pais: string;
  // Fiscal
  crt: string;
  indicadorIe: string;
  cscId: string;
  csc: string;
  defaultNcm: string;
  // Emissão
  serie: number;
  proxNumero: number;
  ambiente: string;
  naturezaOperacao: string;
  // Integração / certificado
  provider: string;
  certValidoAte: string | null;
  certHabilitado: boolean;
}

export async function getEstablishment(org: string): Promise<EstablishmentView> {
  const c = await ensureFiscalConfig(org);
  return {
    cnpj: c.cnpj,
    razaoSocial: c.razaoSocial,
    nomeFantasia: c.nomeFantasia,
    ie: c.ie,
    inscricaoMunicipal: c.inscricaoMunicipal,
    cnaePrincipal: c.cnaePrincipal,
    cnaeSecundarios: c.cnaeSecundarios,
    naturezaJuridica: c.naturezaJuridica,
    porte: c.porte,
    dataAbertura: c.dataAbertura ? c.dataAbertura.toISOString().slice(0, 10) : null,
    situacaoCadastral: c.situacaoCadastral,
    email: c.email,
    telefone: c.telefone,
    site: c.site,
    respNome: c.respNome,
    respCpf: c.respCpf,
    respEmail: c.respEmail,
    respTelefone: c.respTelefone,
    respCargo: c.respCargo,
    cep: c.cep,
    logradouro: c.logradouro,
    numeroEnd: c.numeroEnd,
    complemento: c.complemento,
    bairro: c.bairro,
    municipio: c.municipio,
    uf: c.uf,
    cMun: c.cMun,
    pais: c.pais,
    crt: c.crt,
    indicadorIe: c.indicadorIe,
    cscId: c.cscId,
    csc: c.csc,
    defaultNcm: c.defaultNcm,
    serie: c.serie,
    proxNumero: c.proxNumero,
    ambiente: c.ambiente,
    naturezaOperacao: c.naturezaOperacao,
    provider: c.provider,
    certValidoAte: c.certValidoAte ? c.certValidoAte.toISOString() : null,
    certHabilitado: Boolean(c.focusTokenProducao || c.focusTokenHomologacao),
  };
}

/** Cadastro + estado das etapas, que é o que a tela desenha. */
export async function getEstablishmentWizard(org: string) {
  const [data, readiness] = await Promise.all([
    getEstablishment(org),
    getFiscalReadiness(org),
  ]);
  const steps = computeSteps(readiness.docs);
  return {
    data,
    steps,
    readiness,
    percent: completionPercent(steps),
    resumeAt: firstIncompleteStep(steps),
  };
}

/** Contatos por área. */
export async function listCompanyContacts(org: string) {
  const rows = await prisma.companyContact.findMany({
    where: { organizationId: org },
    orderBy: [{ area: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    area: r.area,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
  }));
}
