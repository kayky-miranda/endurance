import "server-only";
import { createFocusNfeProvider } from "./fiscal-providers/focus-nfe";

/**
 * Abstração de PROVEDOR FISCAL homologado para emissão real de NFC-e (modelo 65).
 *
 * O provedor (ex.: Focus NFe) cuida do certificado digital A1 e da transmissão
 * à SEFAZ; aqui só mapeamos a venda para o payload e interpretamos o retorno.
 * Trocar de provedor = implementar esta interface em outro adapter.
 *
 * Segurança: PRODUÇÃO é travada por padrão. Só é liberada com ambiente=1 (na
 * config da empresa) E a flag de servidor FOCUS_NFE_ALLOW_PRODUCTION=true E um
 * token de produção configurado. Sem isso, cai em homologação ou recusa — nunca
 * transmite à produção por acidente.
 */

export type FiscalAmbiente = "homologacao" | "producao";

export interface NfceEmitItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
}

export interface NfceEmitInput {
  /** Referência idempotente (usamos o id da venda). */
  ref: string;
  ambiente: FiscalAmbiente;
  emissao: Date;
  emit: { cnpj: string; ie: string; crt: string; uf: string };
  dest: { nome: string; doc: string } | null;
  itens: NfceEmitItem[];
  pagamentos: { metodo: string; valor: number }[];
  subtotal: number;
  desconto: number;
  total: number;
}

export type NfceStatus = "autorizado" | "processando" | "rejeitado" | "erro";

export interface NfceEmitResult {
  status: NfceStatus;
  chave?: string;
  numero?: number;
  serie?: number;
  protocolo?: string;
  qrCodeUrl?: string;
  danfeUrl?: string;
  xmlUrl?: string;
  mensagem?: string;
}

export interface FiscalProvider {
  id: string;
  emitNfce(input: NfceEmitInput): Promise<NfceEmitResult>;
  cancelNfce(
    ref: string,
    justificativa: string,
  ): Promise<{ ok: boolean; mensagem?: string }>;
}

export interface FiscalConfigLike {
  provider: string;
  ambiente: string; // "1" produção | "2" homologação
  /**
   * Tokens DA EMPRESA, devolvidos pelo provedor quando o cliente enviou o
   * próprio certificado A1 (modelo multiempresa). Quando presentes têm
   * precedência sobre o token de servidor, que só serve à instalação de
   * empresa única.
   */
  focusTokenProducao?: string;
  focusTokenHomologacao?: string;
}

export type ProviderResolution =
  | { kind: "simulate" }
  | { kind: "provider"; provider: FiscalProvider; ambiente: FiscalAmbiente }
  | { kind: "error"; error: string };

const FOCUS_BASE = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

/**
 * Resolve o que fazer com a config fiscal da empresa: simular (protótipo),
 * emitir por provedor real, ou recusar com um motivo claro (produção bloqueada
 * ou token ausente). NUNCA "cai" silenciosamente na simulação quando o usuário
 * pediu emissão real — isso esconderia que nenhuma nota legal foi emitida.
 */
export function resolveFiscalProvider(
  cfg: FiscalConfigLike,
  deps?: { fetchImpl?: typeof fetch },
): ProviderResolution {
  if (cfg.provider !== "focusnfe") {
    // SIMULAÇÃO EM PRODUÇÃO É RECUSADA.
    //
    // A combinação "emissão simulada" + "ambiente 1" produzia um cupom com
    // chave, QR Code e status "autorizada" — e o único aviso impresso no DANFE
    // dependia de `ambiente === "2"`. Ou seja: o comerciante que trocasse o
    // ambiente para produção sem contratar o provedor entregaria ao cliente um
    // cupom de aparência perfeitamente legítima, sem nada ter sido transmitido
    // à SEFAZ. Ele descobriria na fiscalização.
    //
    // Recusar aqui é melhor do que avisar no papel: o erro aparece no ato da
    // venda, quando ainda dá para corrigir.
    if (cfg.ambiente === "1")
      return {
        kind: "error",
        error:
          "A emissão está configurada como Simulada, que não transmite à SEFAZ e não tem valor fiscal — não é possível usá-la em ambiente de Produção. Contrate um provedor de emissão real ou volte o ambiente para Homologação.",
      };
    return { kind: "simulate" };
  }

  const producao = cfg.ambiente === "1";
  const ambiente: FiscalAmbiente = producao ? "producao" : "homologacao";

  if (producao && process.env.FOCUS_NFE_ALLOW_PRODUCTION !== "true")
    return {
      kind: "error",
      error:
        "Emissão em PRODUÇÃO está desabilitada nesta instalação. Use homologação (ambiente 2) ou habilite FOCUS_NFE_ALLOW_PRODUCTION no servidor.",
    };

  // MULTIEMPRESA: o token da própria empresa (obtido quando o cliente enviou o
  // certificado A1 dele) tem precedência. O token de servidor continua valendo
  // como retaguarda para instalação de empresa única — sem ele, um cliente que
  // ainda não enviou certificado receberia um erro que não sabe resolver.
  const empresaToken = producao
    ? cfg.focusTokenProducao
    : cfg.focusTokenHomologacao;
  const serverToken = producao
    ? process.env.FOCUS_NFE_TOKEN_PRODUCAO
    : process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO;
  const token = (empresaToken || "").trim() || serverToken;
  if (!token)
    return {
      kind: "error",
      error: `Emissão em ${ambiente} indisponível: envie o certificado digital A1 da empresa na aba Fiscal para habilitar a emissão.`,
    };

  const provider = createFocusNfeProvider({
    token,
    baseUrl: FOCUS_BASE[ambiente],
    fetchImpl: deps?.fetchImpl,
  });
  return { kind: "provider", provider, ambiente };
}
