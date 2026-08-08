import "server-only";

/**
 * Cadastro de EMPRESAS no Focus NFe — o que torna o ERP multiempresa fiscal.
 *
 * Modelo: cada cliente envia o certificado A1 da própria empresa; nós
 * cadastramos essa empresa no provedor com o token de PARCEIRO e recebemos de
 * volta um token por empresa, usado dali em diante para emitir as notas dela.
 *
 * SEGURANÇA — a regra que não pode ser relaxada: o `.pfx` e a senha são a
 * identidade digital da empresa. Quem tem os dois assina qualquer coisa em nome
 * dela, não só nota fiscal. Por isso eles atravessam esta função e MORREM AQUI:
 * nada é gravado em banco, em disco ou em log. O provedor passa a ser o
 * guardião — é o negócio dele e ele tem infraestrutura para isso. Guardamos
 * apenas o id da empresa, os tokens e as datas de validade.
 *
 * `dryRun` usa o `?dry_run=1` da própria API: valida a chamada inteira sem
 * persistir nada do lado do provedor. É como o fluxo é exercitado enquanto o
 * contrato de parceria não existe.
 *
 * Doc: https://doc.focusnfe.com.br/reference/criar_empresa
 */

const FOCUS_API = "https://api.focusnfe.com.br/v2/empresas";

export interface CompanyInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  /** Regime tributário (CRT): 1 Simples, 2 Simples excesso, 3 Normal. */
  regimeTributario: string;
  uf: string;
  municipio: string;
  /** Código IBGE do município. */
  codigoMunicipio: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  email: string;
  /** Conteúdo do .pfx/.p12 em base64. NUNCA persistido. */
  certificadoBase64: string;
  /** Senha do certificado. NUNCA persistida. */
  certificadoSenha: string;
}

export interface CompanyResult {
  ok: boolean;
  empresaId?: string;
  tokenProducao?: string;
  tokenHomologacao?: string;
  certValidoDe?: Date;
  certValidoAte?: Date;
  /** A chamada rodou em modo simulado (nada foi persistido no provedor). */
  dryRun?: boolean;
  error?: string;
}

const digits = (s: string) => (s ?? "").replace(/\D/g, "");

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Traduz o corpo de erro do provedor numa frase que o cliente entende.
 * A API devolve `{ codigo, mensagem }` ou uma lista de erros por campo — sem
 * isso o usuário veria um JSON cru e não saberia o que corrigir.
 */
function providerMessage(body: unknown, status: number): string {
  const b = body as
    | { mensagem?: string; erros?: { mensagem?: string; campo?: string }[] }
    | null;
  if (b?.erros?.length) {
    return b.erros
      .map((e) => [e.campo, e.mensagem].filter(Boolean).join(": "))
      .join(" · ");
  }
  if (b?.mensagem) return b.mensagem;
  if (status === 401 || status === 403)
    return "Token de parceiro do Focus NFe inválido ou sem permissão para cadastrar empresas.";
  return `Falha no provedor fiscal (HTTP ${status}).`;
}

/**
 * Cadastra (ou revalida, com `dryRun`) a empresa no provedor.
 *
 * `partnerToken` é o token da SUA conta — é ele que autoriza criar empresas.
 * Não confundir com os tokens devolvidos, que são de cada cliente.
 */
export async function registerCompany(
  partnerToken: string,
  input: CompanyInput,
  opts: { dryRun?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<CompanyResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const dryRun = opts.dryRun ?? false;
  const url = dryRun ? `${FOCUS_API}?dry_run=1` : FOCUS_API;

  // Basic Auth: o token vai como USUÁRIO e a senha fica em branco.
  const auth = Buffer.from(`${partnerToken}:`).toString("base64");

  const payload = {
    nome: input.razaoSocial,
    nome_fantasia: input.nomeFantasia || input.razaoSocial,
    cnpj: digits(input.cnpj),
    inscricao_estadual: digits(input.inscricaoEstadual),
    regime_tributario: input.regimeTributario,
    email: input.email,
    logradouro: input.logradouro,
    numero: input.numero,
    bairro: input.bairro,
    municipio: input.municipio,
    codigo_municipio: digits(input.codigoMunicipio),
    uf: input.uf.toUpperCase().slice(0, 2),
    cep: digits(input.cep),
    arquivo_certificado_base64: input.certificadoBase64,
    senha_certificado: input.certificadoSenha,
    habilita_nfce: true,
  };

  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      // Upload de certificado + validação no provedor é mais lento que uma
      // chamada comum; 30s evita cortar uma operação que ia dar certo.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error && e.name === "TimeoutError"
          ? "O provedor fiscal demorou demais para responder. Tente novamente."
          : "Não foi possível falar com o provedor fiscal.",
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Corpo não-JSON: o status ainda diz o suficiente.
  }

  if (!res.ok) return { ok: false, error: providerMessage(body, res.status) };

  const b = (body ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    dryRun,
    empresaId: b.id != null ? String(b.id) : undefined,
    tokenProducao:
      typeof b.token_producao === "string" ? b.token_producao : undefined,
    tokenHomologacao:
      typeof b.token_homologacao === "string" ? b.token_homologacao : undefined,
    certValidoDe: parseDate(b.certificado_valido_de),
    certValidoAte: parseDate(b.certificado_valido_ate),
  };
}
