/**
 * Prontidão fiscal do estabelecimento — regra PURA, testável sem banco.
 *
 * Responde à pergunta que o cadastro existe para responder: *esta empresa já
 * consegue emitir?* E, quando não consegue, **o que exatamente falta**.
 *
 * Por que isso não é só uma lista de "campos obrigatórios": as exigências
 * DIFEREM por documento. A NFC-e não precisa de Inscrição Municipal; a NFS-e
 * não precisa de Inscrição Estadual nem de CSC; o CSC só existe para NFC-e.
 * Uma lista única marcaria como pendente coisa que não se aplica, e o cliente
 * perseguiria campo que ele nunca vai usar.
 *
 * Cada requisito diz o CAMPO e ONDE resolvê-lo — "dados incompletos" não é
 * mensagem de erro, é adivinhação.
 */

import { isValidCnpj } from "./cnpj";
import { isValidCpf } from "./patient";

export type FiscalDoc = "nfce" | "nfe" | "nfse";

export interface EstablishmentSnapshot {
  cnpj: string;
  razaoSocial: string;
  ie: string;
  inscricaoMunicipal: string;
  cMun: string;
  municipio: string;
  uf: string;
  cep: string;
  logradouro: string;
  numeroEnd: string;
  bairro: string;
  crt: string;
  cscId: string;
  csc: string;
  defaultNcm: string;
  provider: string;
  ambiente: string;
  certValidoAte: Date | null;
  certHabilitado: boolean;
  respNome: string;
  respCpf: string;
}

export interface Requirement {
  /** Identificador estável — a tela usa para destacar o campo. */
  field: string;
  label: string;
  /** Etapa do cadastro onde se resolve. */
  step: "empresa" | "endereco" | "fiscal" | "certificado" | "emissao";
  /** Sem isto o documento NÃO sai. Falso = recomendado, não bloqueante. */
  blocking: boolean;
}

export interface DocReadiness {
  doc: FiscalDoc;
  label: string;
  /** Apto a emitir: nenhum requisito bloqueante pendente. */
  ready: boolean;
  pending: Requirement[];
  /** Recomendações não bloqueantes (qualidade do cadastro). */
  warnings: Requirement[];
  /** O documento está implementado no sistema? */
  supported: boolean;
}

const req = (
  field: string,
  label: string,
  step: Requirement["step"],
  blocking = true,
): Requirement => ({ field, label, step, blocking });

const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const filled = (s: string) => Boolean((s ?? "").trim());

/**
 * Requisitos comuns a qualquer documento fiscal: quem emite, de onde emite.
 * A SEFAZ e as prefeituras rejeitam por endereço incompleto tanto quanto por
 * CNPJ errado — e é o erro mais frequente de cadastro apressado.
 */
function baseRequirements(e: EstablishmentSnapshot): Requirement[] {
  const out: Requirement[] = [];
  if (!isValidCnpj(e.cnpj)) out.push(req("cnpj", "CNPJ válido", "empresa"));
  if (!filled(e.razaoSocial))
    out.push(req("razaoSocial", "Razão social", "empresa"));
  if (!filled(e.logradouro))
    out.push(req("logradouro", "Logradouro", "endereco"));
  if (!filled(e.numeroEnd)) out.push(req("numeroEnd", "Número", "endereco"));
  if (!filled(e.bairro)) out.push(req("bairro", "Bairro", "endereco"));
  if (digits(e.cep).length !== 8) out.push(req("cep", "CEP", "endereco"));
  if (!filled(e.municipio)) out.push(req("municipio", "Município", "endereco"));
  if (digits(e.uf).length === 0 && !filled(e.uf))
    out.push(req("uf", "UF", "endereco"));
  // O código IBGE vai no campo cMun do XML: sem ele a nota nem é montada.
  if (digits(e.cMun).length !== 7)
    out.push(req("cMun", "Código IBGE do município (7 dígitos)", "endereco"));
  return out;
}

/** Certificado: exigido por NF-e e NFC-e. Muitas prefeituras também pedem. */
function certificateRequirements(
  e: EstablishmentSnapshot,
  now: Date,
  uploadDisponivel: boolean,
): Requirement[] {
  const out: Requirement[] = [];
  if (!e.certHabilitado)
    out.push(
      req(
        "certificado",
        // Quando o envio ainda não está liberado, a pendência é NOSSA. Dizer
        // "Certificado digital A1 enviado" mandava o cliente resolver algo que
        // ele não consegue: ele abria a etapa, tentava enviar e só ali
        // descobria que a trava era do nosso lado.
        uploadDisponivel
          ? "Certificado digital A1 enviado"
          : "Emissão fiscal em habilitação — nossa equipe libera o envio do certificado",
        "certificado",
      ),
    );
  else if (e.certValidoAte && e.certValidoAte.getTime() < now.getTime())
    out.push(req("certificado", "Certificado digital vencido", "certificado"));
  return out;
}

function commonWarnings(e: EstablishmentSnapshot): Requirement[] {
  const out: Requirement[] = [];
  if (!filled(e.respNome) || !isValidCpf(e.respCpf))
    out.push(
      req("responsavel", "Responsável legal (nome e CPF)", "empresa", false),
    );
  if (e.ambiente === "2")
    out.push(
      req(
        "ambiente",
        "Ambiente de homologação — as notas não têm valor fiscal",
        "emissao",
        false,
      ),
    );
  return out;
}

/**
 * Avalia a prontidão para cada documento.
 *
 * `supported` separa "falta configurar" de "o sistema ainda não faz". Marcar a
 * NFS-e como pendente de configuração faria o cliente procurar um campo que
 * não existe — e prometeria uma emissão que o ERP não realiza.
 */
export function evaluateReadiness(
  e: EstablishmentSnapshot,
  opts: {
    now?: Date;
    nfseSupported?: boolean;
    /** O envio do certificado está liberado nesta instalação? */
    certificateUploadAvailable?: boolean;
  } = {},
): DocReadiness[] {
  const now = opts.now ?? new Date();
  const base = baseRequirements(e);
  const cert = certificateRequirements(
    e,
    now,
    opts.certificateUploadAvailable ?? true,
  );
  const warns = commonWarnings(e);

  // ---- NFC-e (modelo 65): consumidor no balcão ----
  const nfcePending = [...base, ...cert];
  if (!digits(e.ie)) nfcePending.push(req("ie", "Inscrição Estadual", "fiscal"));
  if (!filled(e.crt)) nfcePending.push(req("crt", "Regime tributário (CRT)", "fiscal"));
  // CSC/CSC-ID é o que assina o QR Code da NFC-e — sem ele o cupom não valida.
  if (!filled(e.csc))
    nfcePending.push(req("csc", "CSC (código de segurança do contribuinte)", "fiscal"));
  if (!filled(e.cscId)) nfcePending.push(req("cscId", "ID do CSC", "fiscal"));
  if (digits(e.defaultNcm).length !== 8)
    nfcePending.push(
      req("defaultNcm", "NCM padrão dos produtos (8 dígitos)", "fiscal"),
    );

  // ---- NF-e (modelo 55): venda a empresa, transporte ----
  const nfePending = [...base, ...cert];
  if (!digits(e.ie)) nfePending.push(req("ie", "Inscrição Estadual", "fiscal"));
  if (!filled(e.crt)) nfePending.push(req("crt", "Regime tributário (CRT)", "fiscal"));
  if (digits(e.defaultNcm).length !== 8)
    nfePending.push(
      req("defaultNcm", "NCM padrão dos produtos (8 dígitos)", "fiscal"),
    );

  // ---- NFS-e: serviço, competência municipal ----
  const nfsePending = [...base];
  if (!digits(e.inscricaoMunicipal))
    nfsePending.push(req("inscricaoMunicipal", "Inscrição Municipal", "fiscal"));

  const nfseSupported = opts.nfseSupported ?? false;

  return [
    {
      doc: "nfce",
      label: "NFC-e (cupom ao consumidor)",
      supported: true,
      pending: dedupe(nfcePending),
      warnings: warns,
      ready: dedupe(nfcePending).length === 0,
    },
    {
      doc: "nfe",
      label: "NF-e (venda a empresa)",
      supported: true,
      pending: dedupe(nfePending),
      warnings: warns,
      ready: dedupe(nfePending).length === 0,
    },
    {
      doc: "nfse",
      label: "NFS-e (serviços)",
      supported: nfseSupported,
      pending: dedupe(nfsePending),
      warnings: warns,
      // Sem suporte no sistema, "pronto" seria mentira mesmo com tudo preenchido.
      ready: nfseSupported && dedupe(nfsePending).length === 0,
    },
  ];
}

/**
 * Requisitos que IMPEDEM a emissão agora — a lista que o gate usa.
 *
 * Existe para o checklist e o bloqueio falarem a MESMA coisa. Antes eram duas
 * fontes de verdade: a tela dizia "nenhuma nota sai" e `emitNfce`, que só
 * conferia CNPJ e razão social, emitia mesmo assim — com número fiscal
 * consumido, status "autorizada" e um QR Code assinado com CSC vazio. O
 * cliente aprendia que o aviso vermelho podia ser ignorado.
 *
 * `simulated` retira o certificado da lista: na emissão simulada não há
 * provedor para assinar nada, e exigi-lo impediria o cliente de experimentar em
 * homologação antes de ter o arquivo em mãos. Todo o resto continua valendo —
 * é o dado que vai dentro do XML.
 */
export function blockingForEmission(
  e: EstablishmentSnapshot,
  doc: FiscalDoc,
  opts: { now?: Date; simulated?: boolean; certificateUploadAvailable?: boolean } = {},
): Requirement[] {
  const alvo = evaluateReadiness(e, {
    now: opts.now,
    certificateUploadAvailable: opts.certificateUploadAvailable,
  }).find((d) => d.doc === doc);
  if (!alvo) return [];
  return opts.simulated
    ? alvo.pending.filter((r) => r.field !== "certificado")
    : alvo.pending;
}

/** Remove requisitos repetidos preservando a ordem (base entra em todos). */
function dedupe(list: Requirement[]): Requirement[] {
  const seen = new Set<string>();
  return list.filter((r) => (seen.has(r.field) ? false : (seen.add(r.field), true)));
}

export type OverallStatus = "completo" | "pendente" | "bloqueado";

/**
 * Semáforo do cadastro. "bloqueado" quando NENHUM documento suportado sai —
 * é o estado em que o cliente não consegue operar de verdade.
 */
export function overallStatus(list: DocReadiness[]): OverallStatus {
  const suportados = list.filter((d) => d.supported);
  if (suportados.length === 0) return "bloqueado";
  if (suportados.every((d) => d.ready && d.warnings.length === 0))
    return "completo";
  if (suportados.some((d) => d.ready)) return "pendente";
  return "bloqueado";
}
