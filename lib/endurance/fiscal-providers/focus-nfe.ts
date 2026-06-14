import "server-only";
import type {
  FiscalProvider,
  NfceEmitInput,
  NfceEmitResult,
  NfceStatus,
} from "../fiscal-provider";

/**
 * Adapter do Focus NFe (https://focusnfe.com.br) para NFC-e (modelo 65).
 *
 * API REST v2: autenticação HTTP Basic com o token como usuário (senha vazia).
 * A emissão é assíncrona — o POST cria o documento (status
 * "processando_autorizacao") e consultamos por `ref` até o status terminal.
 *
 * O `fetch` é injetável para permitir testes sem rede.
 */

const PAG_TPAG: Record<string, string> = {
  dinheiro: "01",
  credito: "03",
  debito: "04",
  pix: "17",
};

/**
 * Defaults tributários para Simples Nacional (CRT=1), espelhando o XML simulado
 * (CFOP 5102 / CSOSN 102). A tributação real é específica do emitente/produto
 * (NCM, CST/CSOSN, PIS/COFINS) — centralizado aqui para ajuste futuro.
 */
const TAX = {
  icmsOrigem: "0",
  csosn: "102",
  pisSituacao: "49",
  cofinsSituacao: "49",
};

const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;
const emissaoISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "-03:00");

export interface FocusNfcePayload {
  cnpj_emitente: string;
  data_emissao: string;
  presenca_comprador: string;
  natureza_operacao: string;
  tipo_documento: string;
  finalidade_emissao: string;
  consumidor_final: string;
  modalidade_frete: string;
  local_destino: string;
  cpf_destinatario?: string;
  nome_destinatario?: string;
  valor_produtos: number;
  valor_desconto: number;
  valor_total: number;
  items: Array<Record<string, unknown>>;
  formas_pagamento: Array<{ forma_pagamento: string; valor_pagamento: number }>;
}

/** Mapeia a venda para o payload de NFC-e do Focus NFe (função pura/testável). */
export function buildFocusNfcePayload(input: NfceEmitInput): FocusNfcePayload {
  const payload: FocusNfcePayload = {
    cnpj_emitente: digits(input.emit.cnpj),
    data_emissao: emissaoISO(input.emissao),
    presenca_comprador: "1",
    natureza_operacao: "Venda ao consumidor",
    tipo_documento: "1",
    finalidade_emissao: "1",
    consumidor_final: "1",
    modalidade_frete: "9",
    local_destino: "1",
    valor_produtos: round2(input.subtotal),
    valor_desconto: round2(input.desconto),
    valor_total: round2(input.total),
    items: input.itens.map((it, i) => ({
      numero_item: i + 1,
      codigo_produto: it.codigo || String(i + 1),
      descricao: it.descricao,
      codigo_ncm: digits(it.ncm),
      cfop: it.cfop,
      unidade_comercial: it.unidade,
      quantidade_comercial: round2(it.quantidade),
      valor_unitario_comercial: round2(it.valorUnitario),
      valor_bruto: round2(it.quantidade * it.valorUnitario),
      unidade_tributavel: it.unidade,
      quantidade_tributavel: round2(it.quantidade),
      valor_unitario_tributavel: round2(it.valorUnitario),
      icms_origem: TAX.icmsOrigem,
      icms_situacao_tributaria: TAX.csosn,
      pis_situacao_tributaria: TAX.pisSituacao,
      cofins_situacao_tributaria: TAX.cofinsSituacao,
    })),
    formas_pagamento: input.pagamentos.map((p) => ({
      forma_pagamento: PAG_TPAG[p.metodo] ?? "99",
      valor_pagamento: round2(p.valor),
    })),
  };
  if (input.dest?.doc) {
    payload.cpf_destinatario = digits(input.dest.doc);
    if (input.dest.nome) payload.nome_destinatario = input.dest.nome;
  }
  return payload;
}

/** Forma do retorno do Focus que consumimos (campos relevantes). */
interface FocusResponse {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  mensagem?: string;
  erros?: Array<{ mensagem?: string; campo?: string }>;
  chave_nfe?: string;
  numero?: string | number;
  serie?: string | number;
  protocolo?: string;
  qrcode?: string;
  qrcode_url?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
}

/** Mapeia o status textual do Focus para o nosso enum. */
function mapStatus(focus: string | undefined): NfceStatus {
  switch (focus) {
    case "autorizado":
      return "autorizado";
    case "processando_autorizacao":
      return "processando";
    case "erro_autorizacao":
    case "denegado":
      return "rejeitado";
    default:
      return "erro";
  }
}

function firstError(r: FocusResponse): string | undefined {
  return (
    r.mensagem_sefaz ||
    r.mensagem ||
    r.erros?.map((e) => e.mensagem).filter(Boolean).join("; ") ||
    undefined
  );
}

export interface FocusNfeDeps {
  token: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  maxPolls?: number;
  pollDelayMs?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

export function createFocusNfeProvider(deps: FocusNfeDeps): FiscalProvider {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleepImpl ?? defaultSleep;
  const maxPolls = deps.maxPolls ?? 5;
  const pollDelayMs = deps.pollDelayMs ?? 1200;
  // Basic com token como usuário e senha vazia.
  const auth = "Basic " + Buffer.from(`${deps.token}:`).toString("base64");
  const base = deps.baseUrl.replace(/\/$/, "");

  async function call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ httpOk: boolean; data: FocusResponse }> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: FocusResponse = {};
    try {
      data = (await res.json()) as FocusResponse;
    } catch {
      data = {};
    }
    return { httpOk: res.ok, data };
  }

  function fullUrl(p: string | undefined): string {
    if (!p) return "";
    return /^https?:\/\//i.test(p) ? p : `${base}/${p.replace(/^\//, "")}`;
  }

  function toResult(r: FocusResponse): NfceEmitResult {
    const status = mapStatus(r.status);
    if (status === "autorizado") {
      return {
        status,
        chave: r.chave_nfe,
        numero: r.numero != null ? Number(r.numero) : undefined,
        serie: r.serie != null ? Number(r.serie) : undefined,
        protocolo: r.protocolo,
        qrCodeUrl: r.qrcode || r.qrcode_url,
        danfeUrl: fullUrl(r.caminho_danfe),
        xmlUrl: fullUrl(r.caminho_xml_nota_fiscal),
      };
    }
    return { status, mensagem: firstError(r) };
  }

  return {
    id: "focusnfe",

    async emitNfce(input: NfceEmitInput): Promise<NfceEmitResult> {
      const payload = buildFocusNfcePayload(input);
      const ref = encodeURIComponent(input.ref);
      try {
        const post = await call("POST", `/v2/nfce?ref=${ref}`, payload);

        // Erro de validação síncrono (payload inválido) — sem ref duplicada.
        const postStatus = mapStatus(post.data.status);
        if (
          !post.httpOk &&
          post.data.status !== "processando_autorizacao" &&
          postStatus !== "processando"
        ) {
          // 422 com "ref" já existente: seguimos para a consulta (idempotência).
          const dupRef = (firstError(post.data) ?? "")
            .toLowerCase()
            .includes("referência");
          if (!dupRef && post.data.status == null)
            return {
              status: "erro",
              mensagem:
                firstError(post.data) ?? "Falha ao enviar a NFC-e ao provedor.",
            };
        }

        // Se o POST já trouxe status terminal, devolve direto.
        if (post.data.status && mapStatus(post.data.status) !== "processando")
          return toResult(post.data);

        // Consulta por ref até status terminal ou esgotar as tentativas.
        for (let i = 0; i < maxPolls; i++) {
          await sleep(pollDelayMs);
          const { data } = await call("GET", `/v2/nfce/${ref}?completa=1`);
          if (data.status && mapStatus(data.status) !== "processando")
            return toResult(data);
        }
        return {
          status: "processando",
          mensagem: "Emissão em processamento na SEFAZ.",
        };
      } catch (e) {
        return {
          status: "erro",
          mensagem: `Falha de comunicação com o provedor fiscal: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    async cancelNfce(ref: string, justificativa: string) {
      try {
        const { httpOk, data } = await call(
          "DELETE",
          `/v2/nfce/${encodeURIComponent(ref)}`,
          { justificativa },
        );
        if (data.status === "cancelado" || httpOk) return { ok: true };
        return { ok: false, mensagem: firstError(data) ?? "Falha ao cancelar." };
      } catch (e) {
        return {
          ok: false,
          mensagem: `Falha de comunicação com o provedor fiscal: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },
  };
}
