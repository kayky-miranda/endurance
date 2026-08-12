import { onlyDigits, isValidCnpj } from "./cnpj";

/**
 * Consulta de dados públicos por CNPJ (BrasilAPI → dados abertos da Receita)
 * e por CEP (ViaCEP). APIs gratuitas, sem chave. Usadas para auto-preencher
 * o cadastro de fornecedores e a configuração fiscal — inclusive o código
 * IBGE do município (cMun), obrigatório na NFC-e e chato de achar à mão.
 *
 * `fetchImpl` é injetável para testes sem rede. Sem `server-only` de
 * propósito: funções puras de rede, sem segredo nenhum.
 */

export interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  /** Logradouro, número e bairro combinados num endereço legível. */
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  /** Código IBGE do município (7 dígitos) — vai direto no cMun da NFC-e. */
  codigoMunicipioIbge: string;
  /** Situação cadastral na Receita (ex.: ATIVA, BAIXADA). */
  situacao: string;
}

export type CnpjLookupResult =
  | { ok: true; data: CnpjData }
  | { ok: false; error: string };

interface BrasilApiCnpj {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string | null;
  codigo_municipio_ibge?: number | string;
  descricao_situacao_cadastral?: string;
}

/**
 * A BrasilAPI (Cloudflare) responde 403 para fetch sem User-Agent — header
 * obrigatório, verificado em teste real.
 */
const HEADERS = {
  "User-Agent": "ENDURANCE-ERP/1.0",
  Accept: "application/json",
};

const joinAddress = (r: BrasilApiCnpj): string =>
  [r.logradouro, r.numero, r.bairro]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");

export async function lookupCnpj(
  rawCnpj: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<CnpjLookupResult> {
  const digits = onlyDigits(rawCnpj);
  if (!isValidCnpj(digits))
    return { ok: false, error: "CNPJ inválido — confira os dígitos." };

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      { headers: HEADERS, signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) },
    );
    if (res.status === 404)
      return { ok: false, error: "CNPJ não encontrado na Receita." };
    if (!res.ok)
      return { ok: false, error: "Consulta indisponível agora. Tente de novo." };

    const r = (await res.json()) as BrasilApiCnpj;
    return {
      ok: true,
      data: {
        cnpj: digits,
        razaoSocial: (r.razao_social ?? "").trim(),
        nomeFantasia: (r.nome_fantasia ?? "").trim(),
        address: joinAddress(r),
        city: (r.municipio ?? "").trim(),
        state: (r.uf ?? "").trim().toUpperCase(),
        zip: onlyDigits(r.cep ?? ""),
        phone: (r.ddd_telefone_1 ?? "").trim(),
        email: (r.email ?? "").trim(),
        codigoMunicipioIbge: onlyDigits(String(r.codigo_municipio_ibge ?? "")),
        situacao: (r.descricao_situacao_cadastral ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, error: "Consulta indisponível agora. Tente de novo." };
  }
}

export interface CepData {
  zip: string;
  /**
   * Logradouro + bairro juntos, para telas que mostram o endereço em uma linha
   * só (ficha de paciente, por exemplo).
   *
   * NÃO use em cadastro fiscal: a NF-e exige logradouro e bairro em campos
   * separados. Era o que acontecia no cadastro do estabelecimento — o bairro
   * ia junto dentro do logradouro e o campo Bairro ficava vazio, seguindo como
   * pendência que o cliente tinha de resolver recortando o texto na mão.
   */
  address: string;
  /** Logradouro isolado, como veio do ViaCEP. */
  street: string;
  /** Bairro isolado. */
  district: string;
  city: string;
  state: string;
}

export type CepLookupResult =
  | { ok: true; data: CepData }
  | { ok: false; error: string };

interface ViaCep {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export async function lookupCep(
  rawCep: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<CepLookupResult> {
  const digits = onlyDigits(rawCep);
  if (digits.length !== 8) return { ok: false, error: "CEP inválido (8 dígitos)." };

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    if (!res.ok)
      return { ok: false, error: "Consulta indisponível agora. Tente de novo." };
    const r = (await res.json()) as ViaCep;
    if (r.erro) return { ok: false, error: "CEP não encontrado." };
    return {
      ok: true,
      data: {
        zip: digits,
        address: [r.logradouro, r.bairro]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(", "),
        street: (r.logradouro ?? "").trim(),
        district: (r.bairro ?? "").trim(),
        city: (r.localidade ?? "").trim(),
        state: (r.uf ?? "").trim().toUpperCase(),
      },
    };
  } catch {
    return { ok: false, error: "Consulta indisponível agora. Tente de novo." };
  }
}
