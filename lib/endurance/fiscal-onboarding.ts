import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { registerCompany, type CompanyInput } from "./fiscal-providers/focus-empresas";
import { ensureFiscalConfig } from "./fiscal-service";

/**
 * Habilitação fiscal do CLIENTE: envia o certificado A1 da empresa dele ao
 * provedor e guarda os tokens devolvidos.
 *
 * É o que permite o ERP emitir nota de várias empresas sem nunca possuir um
 * certificado próprio — cada cliente traz o seu.
 *
 * O certificado e a senha NÃO chegam ao banco. Entram por aqui, seguem para o
 * provedor e são descartados junto com a requisição. Ver a nota em
 * `fiscal-providers/focus-empresas.ts`.
 */

export type FiscalOnboardResult =
  | {
      ok: true;
      dryRun: boolean;
      certValidoAte: Date | null;
    }
  | { ok: false; error: string };

/** Limite do arquivo. Um A1 real tem alguns KB; acima disso não é certificado. */
const MAX_PFX_BYTES = 512 * 1024;

/**
 * Campos sem os quais o provedor recusa o cadastro. Conferimos ANTES de enviar
 * para o cliente receber uma lista do que preencher, em vez de um erro genérico
 * do provedor depois de já ter digitado a senha do certificado.
 */
function missingFields(cfg: {
  cnpj: string;
  razaoSocial: string;
  ie: string;
  uf: string;
  municipio: string;
  cMun: string;
}): string[] {
  const faltando: string[] = [];
  if (!cfg.cnpj.replace(/\D/g, "")) faltando.push("CNPJ");
  if (!cfg.razaoSocial.trim()) faltando.push("razão social");
  if (!cfg.ie.replace(/\D/g, "")) faltando.push("inscrição estadual");
  if (!cfg.uf.trim()) faltando.push("UF");
  if (!cfg.municipio.trim()) faltando.push("município");
  if (!cfg.cMun.replace(/\D/g, "")) faltando.push("código IBGE do município");
  return faltando;
}

export interface OnboardInput {
  /** Conteúdo do .pfx. Convertido para base64 aqui e descartado em seguida. */
  certificado: ArrayBuffer;
  senha: string;
  /** Endereço do emitente (o provedor exige; não vive na FiscalConfig hoje). */
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
  };
  email: string;
}

export async function onboardFiscalCompany(
  org: string,
  input: OnboardInput,
  opts: { dryRun?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<FiscalOnboardResult> {
  const partnerToken = process.env.FOCUS_NFE_PARTNER_TOKEN;
  if (!partnerToken)
    return {
      ok: false,
      error:
        "O cadastro de empresas no provedor fiscal ainda não está habilitado nesta instalação (falta o token de parceiro).",
    };

  if (!input.senha.trim())
    return { ok: false, error: "Informe a senha do certificado." };
  if (input.certificado.byteLength === 0)
    return { ok: false, error: "Selecione o arquivo do certificado (.pfx)." };
  if (input.certificado.byteLength > MAX_PFX_BYTES)
    return {
      ok: false,
      error: "Arquivo grande demais para um certificado A1 — confira se enviou o .pfx correto.",
    };

  const cfg = await ensureFiscalConfig(org);
  const faltando = missingFields(cfg);
  if (faltando.length)
    return {
      ok: false,
      error: `Complete os dados fiscais antes de enviar o certificado: ${faltando.join(", ")}.`,
    };

  const payload: CompanyInput = {
    cnpj: cfg.cnpj,
    razaoSocial: cfg.razaoSocial,
    nomeFantasia: cfg.nomeFantasia,
    inscricaoEstadual: cfg.ie,
    regimeTributario: cfg.crt,
    uf: cfg.uf,
    municipio: cfg.municipio,
    codigoMunicipio: cfg.cMun,
    cep: input.endereco.cep,
    logradouro: input.endereco.logradouro,
    numero: input.endereco.numero,
    bairro: input.endereco.bairro,
    email: input.email,
    certificadoBase64: Buffer.from(input.certificado).toString("base64"),
    certificadoSenha: input.senha,
  };

  const res = await registerCompany(partnerToken, payload, opts);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha ao cadastrar a empresa no provedor." };

  // Em dry_run o provedor valida tudo mas não persiste — e não devolve tokens
  // utilizáveis. Gravar o que veio faria o sistema acreditar que está apto a
  // emitir quando não está: guardamos apenas a validade, que já é informação
  // real e útil, e mantemos a emissão como estava.
  if (res.dryRun) {
    await prisma.fiscalConfig.update({
      where: { organizationId: org },
      data: {
        certValidoDe: res.certValidoDe ?? null,
        certValidoAte: res.certValidoAte ?? null,
      },
    });
    logger.info("Cadastro fiscal validado em dry-run", { org });
    return { ok: true, dryRun: true, certValidoAte: res.certValidoAte ?? null };
  }

  await prisma.fiscalConfig.update({
    where: { organizationId: org },
    data: {
      focusEmpresaId: res.empresaId ?? "",
      focusTokenHomologacao: res.tokenHomologacao ?? "",
      focusTokenProducao: res.tokenProducao ?? "",
      certValidoDe: res.certValidoDe ?? null,
      certValidoAte: res.certValidoAte ?? null,
      // A empresa passa a ter emissão real disponível; o ambiente continua
      // sendo escolha do cliente (homologação até ele validar).
      provider: "focusnfe",
    },
  });
  logger.info("Empresa cadastrada no provedor fiscal", {
    org,
    empresaId: res.empresaId,
  });

  return { ok: true, dryRun: false, certValidoAte: res.certValidoAte ?? null };
}
