import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  PAGE_SIZE,
  clampPage,
  pageMeta,
  type PageMeta,
} from "./pagination";
import {
  buildAccessKey,
  buildQrCode,
  buildNfceXml,
  buildProtocolo,
  randomCNF,
} from "./fiscal";
import {
  resolveFiscalProvider,
  type FiscalAmbiente,
  type FiscalProvider,
  type NfceEmitInput,
  type NfceEmitItem,
} from "./fiscal-provider";
import {
  cancelWindowLabel,
  cancelWindowMinutes,
  withinCancelWindow,
} from "./fiscal-cancel-window";
import { checkNfceDestinatario } from "./nfce-destinatario";
import {
  blockingForEmission,
  evaluateReadiness,
  overallStatus,
  type EstablishmentSnapshot,
} from "./fiscal-readiness";
import { icmsCodigo, type TaxConfig } from "./tax-defaults";
import { fetchXmlContent } from "./fiscal-xml";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export interface FiscalConfigView {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  ie: string;
  crt: string;
  uf: string;
  cMun: string;
  municipio: string;
  serie: number;
  proxNumero: number;
  ambiente: string;
  cscId: string;
  csc: string;
  provider: string;
  defaultNcm: string;
  configured: boolean;
  /** Validade do certificado A1 no provedor (ISO) — null se não houver. */
  certValidoAte: string | null;
  /** A empresa já tem token próprio no provedor (emissão real habilitada). */
  certHabilitado: boolean;
}

/**
 * Lê a config fiscal; cria uma padrão (a partir da org) se ainda não existir.
 *
 * UPSERT e não "ler, depois criar": duas chamadas concorrentes encontravam a
 * linha ausente e ambas tentavam criar, estourando a unicidade de
 * `organizationId`. Não era hipótese — a própria tela do estabelecimento carrega
 * o cadastro e a prontidão em `Promise.all`, e as duas passam por aqui. Quebrava
 * na PRIMEIRA visita de cada cliente, justamente quando a linha ainda não existe.
 */
export async function ensureFiscalConfig(org: string) {
  const existing = await prisma.fiscalConfig.findUnique({
    where: { organizationId: org },
  });
  if (existing) return existing;

  const o = await prisma.organization.findUnique({ where: { id: org } });
  return prisma.fiscalConfig.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      razaoSocial: o?.name ?? "",
      nomeFantasia: o?.name ?? "",
      uf: (o?.state || "SP").toUpperCase().slice(0, 2),
      municipio: o?.city ?? "",
    },
    // Vazio de propósito: quem chegou depois na corrida só quer a linha que o
    // outro criou, sem sobrescrever nada.
    update: {},
  });
}

export async function getFiscalConfigView(org: string): Promise<FiscalConfigView> {
  const c = await ensureFiscalConfig(org);
  return {
    cnpj: c.cnpj,
    razaoSocial: c.razaoSocial,
    nomeFantasia: c.nomeFantasia,
    ie: c.ie,
    crt: c.crt,
    uf: c.uf,
    cMun: c.cMun,
    municipio: c.municipio,
    serie: c.serie,
    proxNumero: c.proxNumero,
    ambiente: c.ambiente,
    cscId: c.cscId,
    csc: c.csc,
    provider: c.provider,
    defaultNcm: c.defaultNcm,
    configured: Boolean(c.cnpj && c.razaoSocial),
    certValidoAte: c.certValidoAte ? c.certValidoAte.toISOString() : null,
    certHabilitado: Boolean(c.focusTokenProducao || c.focusTokenHomologacao),
  };
}

export type EmitResult =
  | { ok: true; docId: string; chave: string; numero: number }
  | { ok: false; error: string };

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

type SaleWithRelations = Prisma.SaleGetPayload<{
  include: { items: true; payments: true; customer: true; fiscalDoc: true };
}>;
type FiscalCfg = Awaited<ReturnType<typeof ensureFiscalConfig>>;

/**
 * Emite a NFC-e de uma venda. Despacha entre:
 *  - emissão REAL via provedor homologado (cfg.provider = "focusnfe"); ou
 *  - emissão SIMULADA (protótipo), quando nenhum provedor está configurado.
 * Idempotente: se a venda já tem documento ativo, retorna o existente.
 */
export async function emitNfce(org: string, saleId: string): Promise<EmitResult> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, payments: true, customer: true, fiscalDoc: true },
  });
  if (!sale || sale.organizationId !== org)
    return { ok: false, error: "Venda não encontrada." };
  if (sale.fiscalDoc && sale.fiscalDoc.status !== "cancelada")
    return {
      ok: true,
      docId: sale.fiscalDoc.id,
      chave: sale.fiscalDoc.chave,
      numero: sale.fiscalDoc.numero,
    };

  const cfg = await ensureFiscalConfig(org);
  if (!cfg.cnpj || !cfg.razaoSocial)
    return {
      ok: false,
      error: "Complete os dados fiscais (CNPJ e razão social) antes de emitir.",
    };

  // Destinatário pessoa jurídica: a SEFAZ recusa NFC-e desde jan/2026. A
  // checagem fica ANTES do despacho para valer nos dois caminhos (simulado e
  // provedor real) — na simulação ela também importa, senão a homologação
  // ensinaria um fluxo que quebra no primeiro dia de produção.
  const dest = checkNfceDestinatario(sale.customer?.document);
  if (!dest.ok) return { ok: false, error: dest.error! };

  const resolution = resolveFiscalProvider(cfg);
  if (resolution.kind === "error") return { ok: false, error: resolution.error };

  // GATE DE PRONTIDÃO — a mesma lista que o checklist da tela mostra.
  //
  // Antes eram duas fontes de verdade: a tela dizia "nenhuma nota sai" e aqui
  // só se conferia CNPJ e razão social, então a nota saía — consumindo número
  // fiscal, com status "autorizada" e QR Code assinado sobre um CSC vazio.
  // Recusar aqui é o que faz o aviso da tela significar alguma coisa.
  const faltando = blockingForEmission(toSnapshot(cfg), "nfce", {
    simulated: resolution.kind === "simulate",
  });
  if (faltando.length)
    return {
      ok: false,
      error:
        `Complete o cadastro do estabelecimento antes de emitir. Falta: ${faltando
          .map((f) => f.label)
          .join(", ")}.`,
    };

  if (resolution.kind === "provider")
    return emitNfceViaProvider(
      org,
      sale,
      cfg,
      resolution.ambiente,
      resolution.provider,
    );
  return emitNfceSimulated(org, sale, cfg);
}

/** Emissão real via provedor: o provedor assina/transmite e devolve a chave. */
/** Item de venda com o mínimo necessário para montar a linha fiscal. */
interface SaleLineLike {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}
interface ProductFiscal {
  id: string;
  ncm: string;
  unit: string;
}

/**
 * Resolve NCM e unidade de cada item da nota (função pura, testável).
 * Regra: usa o NCM do PRODUTO (8 díg.) quando houver; senão o NCM padrão da
 * empresa. A unidade vem do produto (fallback "UN"). Coleta em `semNcm` os
 * itens que ficaram sem NCM válido, para o chamador bloquear a emissão.
 */
export function resolveNfceItems(
  items: SaleLineLike[],
  products: ProductFiscal[],
  companyDefaultNcm: string,
  cfopPadrao = "5102",
): { itens: NfceEmitItem[]; semNcm: string[] } {
  const defaultNcm = (companyDefaultNcm ?? "").replace(/\D/g, "");
  const byId = new Map(products.map((p) => [p.id, p]));
  const semNcm: string[] = [];

  const itens = items.map((it) => {
    const prod = it.productId ? byId.get(it.productId) : undefined;
    const prodNcm = (prod?.ncm ?? "").replace(/\D/g, "");
    const ncm = prodNcm.length === 8 ? prodNcm : defaultNcm;
    if (ncm.length !== 8) semNcm.push(it.name);
    return {
      codigo: it.productId ?? "",
      descricao: it.name,
      ncm,
      cfop: cfopPadrao,
      unidade: (prod?.unit || "un").toUpperCase(),
      quantidade: it.quantity,
      valorUnitario: it.unitPrice,
    };
  });

  return { itens, semNcm };
}


/** Recorte tributário da empresa para o emissor (mantém a regra pura). */
function taxConfigFrom(cfg: FiscalCfg): TaxConfig {
  return {
    cfopPadrao: cfg.cfopPadrao,
    icmsOrigem: cfg.icmsOrigem,
    csosn: cfg.csosn,
    cstIcms: cfg.cstIcms,
    pisSituacao: cfg.pisSituacao,
    cofinsSituacao: cfg.cofinsSituacao,
    finalidade: cfg.finalidade,
    consumidorFinal: cfg.consumidorFinal,
    presencaComprador: cfg.presencaComprador,
  };
}

async function emitNfceViaProvider(
  org: string,
  sale: SaleWithRelations,
  cfg: FiscalCfg,
  ambiente: FiscalAmbiente,
  provider: FiscalProvider,
): Promise<EmitResult> {
  // Carrega os produtos das linhas para usar NCM e unidade REAIS de cada item;
  // o defaultNcm da empresa só entra como fallback quando o produto não tem NCM.
  const productIds = sale.items
    .map((it) => it.productId)
    .filter((id): id is string => Boolean(id));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { organizationId: org, id: { in: productIds } },
        select: { id: true, ncm: true, unit: true },
      })
    : [];

  const resolved = resolveNfceItems(
    sale.items.map((it) => ({
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      unitPrice: money(it.unitPrice),
    })),
    products,
    cfg.defaultNcm,
    cfg.cfopPadrao,
  );

  // A SEFAZ valida o NCM (8 díg.) de cada item — bloqueia antes de transmitir
  // se algum item ficou sem NCM próprio E sem NCM padrão da empresa.
  if (resolved.semNcm.length)
    return {
      ok: false,
      error:
        `Sem NCM (8 dígitos) para: ${resolved.semNcm.join(", ")}. ` +
        "Defina o NCM no cadastro do produto ou configure o NCM padrão da empresa na aba Fiscal.",
    };
  const itens = resolved.itens;

  const emissao = new Date();
  const input: NfceEmitInput = {
    ref: sale.id,
    ambiente,
    emissao,
    emit: { cnpj: cfg.cnpj, ie: cfg.ie, crt: cfg.crt, uf: cfg.uf },
    tributacao: taxConfigFrom(cfg),
    naturezaOperacao: cfg.naturezaOperacao,
    dest: sale.customer?.document
      ? { nome: sale.customer.name, doc: sale.customer.document }
      : null,
    itens,
    pagamentos: sale.payments.map((p) => ({
      metodo: p.method,
      valor: money(p.amount),
    })),
    subtotal: money(sale.subtotal),
    desconto: money(sale.discount),
    total: money(sale.total),
  };

  const r = await provider.emitNfce(input);
  if (r.status !== "autorizado") {
    const fallback =
      r.status === "processando"
        ? "Emissão em processamento na SEFAZ. Aguarde alguns instantes e tente novamente."
        : r.status === "rejeitado"
          ? "NFC-e rejeitada pela SEFAZ."
          : "Falha na emissão fiscal.";
    return { ok: false, error: r.mensagem ?? fallback };
  }
  if (!r.chave)
    return {
      ok: false,
      error: "O provedor autorizou a nota mas não retornou a chave de acesso.",
    };

  const numero = r.numero ?? 0;
  // Retenção legal: captura uma cópia própria do XML autorizado (best-effort).
  const xml = await fetchXmlContent(r.xmlUrl);
  if (!xml && r.xmlUrl)
    logger.warn("NFC-e autorizada mas XML não pôde ser baixado do provedor", {
      org,
      saleId: sale.id,
      chave: r.chave,
    });
  const data = {
    organizationId: org,
    saleId: sale.id,
    modelo: "65",
    serie: r.serie ?? cfg.serie,
    numero,
    chave: r.chave,
    status: "autorizada",
    ambiente: cfg.ambiente,
    protocolo: r.protocolo ?? "",
    qrCode: r.qrCodeUrl ?? "",
    xml,
    valorTotal: sale.total,
    provider: provider.id,
    providerRef: sale.id,
    danfeUrl: r.danfeUrl ?? "",
    dataEmissao: emissao,
    dataAutorizacao: new Date(),
  };
  try {
    const doc = await prisma.fiscalDocument.upsert({
      where: { saleId: sale.id },
      create: data,
      update: { ...data, motivoCancel: "", dataCancel: null },
    });
    return { ok: true, docId: doc.id, chave: r.chave, numero };
  } catch {
    return { ok: false, error: "Falha ao gravar o documento fiscal." };
  }
}

/** Emissão simulada (protótipo): monta chave/QR/XML e marca como autorizada. */
async function emitNfceSimulated(
  org: string,
  sale: SaleWithRelations,
  cfg: FiscalCfg,
): Promise<EmitResult> {
  // Reserva o número da nota de forma atômica.
  const updated = await prisma.fiscalConfig.update({
    where: { organizationId: org },
    data: { proxNumero: { increment: 1 } },
  });
  const numero = updated.proxNumero - 1;

  const emissao = new Date();
  const chave = buildAccessKey({
    uf: cfg.uf,
    cnpj: cfg.cnpj,
    modelo: "65",
    serie: cfg.serie,
    numero,
    emissao,
    cNF: randomCNF(),
  });
  const qrCode = buildQrCode({
    chave,
    uf: cfg.uf,
    ambiente: cfg.ambiente,
    cscId: cfg.cscId,
    csc: cfg.csc,
  });
  const xml = buildNfceXml({
    chave,
    ambiente: cfg.ambiente,
    serie: cfg.serie,
    numero,
    emissao,
    // A simulação passa a refletir a tributação REAL da empresa: assim a
    // homologação ensina o mesmo leiaute que a produção vai exigir.
    tributacao: {
      cfopPadrao: cfg.cfopPadrao,
      icmsOrigem: cfg.icmsOrigem,
      csosn: cfg.csosn,
      cstIcms: cfg.cstIcms,
    },
    emit: {
      cnpj: cfg.cnpj,
      razaoSocial: cfg.razaoSocial,
      nomeFantasia: cfg.nomeFantasia,
      ie: cfg.ie,
      crt: cfg.crt,
      uf: cfg.uf,
      municipio: cfg.municipio,
      cMun: cfg.cMun,
    },
    dest: sale.customer?.document
      ? { nome: sale.customer.name, doc: sale.customer.document }
      : null,
    itens: sale.items.map((it) => ({
      nome: it.name,
      quantidade: it.quantity,
      valorUnit: money(it.unitPrice),
      codigo: it.productId ?? "",
    })),
    subtotal: money(sale.subtotal),
    desconto: money(sale.discount),
    total: money(sale.total),
    pagamentos: sale.payments.map((p) => ({
      metodo: p.method,
      valor: money(p.amount),
    })),
  });
  const protocolo = buildProtocolo(cfg.uf, emissao);

  try {
    const doc = await prisma.fiscalDocument.upsert({
      where: { saleId: sale.id },
      create: {
        organizationId: org,
        saleId: sale.id,
        modelo: "65",
        serie: cfg.serie,
        numero,
        chave,
        status: "autorizada",
        ambiente: cfg.ambiente,
        protocolo,
        qrCode,
        xml,
        valorTotal: sale.total,
        dataEmissao: emissao,
        dataAutorizacao: emissao,
      },
      update: {
        numero,
        chave,
        status: "autorizada",
        ambiente: cfg.ambiente,
        protocolo,
        qrCode,
        xml,
        valorTotal: sale.total,
        dataEmissao: emissao,
        dataAutorizacao: emissao,
        motivoCancel: "",
        dataCancel: null,
      },
    });
    return { ok: true, docId: doc.id, chave, numero };
  } catch {
    return { ok: false, error: "Falha ao gravar o documento fiscal." };
  }
}

export async function cancelNfce(
  org: string,
  docId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const doc = await prisma.fiscalDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.organizationId !== org)
    return { ok: false, error: "Documento não encontrado." };
  if (doc.status === "cancelada") return { ok: true };
  const m = (motivo ?? "").trim();
  if (m.length < 15)
    return { ok: false, error: "A justificativa precisa ter ao menos 15 caracteres." };

  // Documento emitido por provedor real: o cancelamento precisa passar pela
  // SEFAZ via provedor. Sem provedor disponível, não cancelamos localmente
  // (evita o documento ficar "cancelado" aqui e "autorizado" na SEFAZ).
  if (doc.provider === "focusnfe") {
    const cfg = await ensureFiscalConfig(org);
    const resolution = resolveFiscalProvider(cfg);
    if (resolution.kind !== "provider")
      return {
        ok: false,
        error:
          resolution.kind === "error"
            ? resolution.error
            : "Provedor fiscal indisponível para cancelar este documento.",
      };
    const c = await resolution.provider.cancelNfce(doc.providerRef, m);
    if (!c.ok) {
      // A recusa fora do prazo chegava como mensagem técnica do provedor, e o
      // operador não tinha como saber que a causa era o relógio. Explicamos a
      // causa provável e o caminho correto — sem esconder o retorno original.
      const foraDoPrazo = !withinCancelWindow(doc.modelo, doc.dataAutorizacao);
      const detalhe = c.mensagem ?? "Falha ao cancelar na SEFAZ.";
      return {
        ok: false,
        error: foraDoPrazo
          ? `${detalhe} O prazo de cancelamento (${cancelWindowMinutes(doc.modelo)} min após a autorização) já passou — nesse caso o caminho é emitir uma nota de devolução.`
          : detalhe,
      };
    }
  } else if (!withinCancelWindow(doc.modelo, doc.dataAutorizacao)) {
    // Documento SIMULADO: aqui a autoridade somos nós. Recusar fora do prazo
    // mantém a homologação fiel ao que vai acontecer em produção — deixar
    // cancelar uma semana depois ensinaria um hábito que falha no dia real.
    return {
      ok: false,
      error: `Prazo de cancelamento encerrado (${cancelWindowMinutes(doc.modelo)} min após a autorização). Em produção a SEFAZ recusaria — o caminho é emitir uma nota de devolução.`,
    };
  }

  await prisma.fiscalDocument.update({
    where: { id: docId },
    data: { status: "cancelada", motivoCancel: m, dataCancel: new Date() },
  });
  return { ok: true };
}

export interface NfceRow {
  saleId: string;
  docId: string | null;
  numero: number | null;
  status: "autorizada" | "cancelada" | "pendente";
  chave: string | null;
  total: number;
  cliente: string;
  quando: string;
  /** Documento simulado (nunca transmitido à SEFAZ). */
  simulado: boolean;
  /** Ainda dentro do prazo de cancelamento? */
  podeCancelar: boolean;
  /** Texto do prazo para o operador — vazio quando não se aplica. */
  prazoCancelamento: string;
}

export interface NfceOverview {
  config: FiscalConfigView;
  rows: NfceRow[];
  pageMeta: PageMeta;
  kpis: {
    autorizadasMes: number;
    valorMes: number;
    emitidasHoje: number;
    pendentes: number;
  };
}

export async function getNfceOverview(
  org: string,
  rawPage = 1,
): Promise<NfceOverview> {
  const config = await getFiscalConfigView(org);

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);

  // KPIs agregados no banco (contagens/somas globais, não da página atual).
  const [salesTotal, mes, emitidasHoje, pendentes] = await Promise.all([
    prisma.sale.count({ where: { organizationId: org } }),
    prisma.fiscalDocument.aggregate({
      where: {
        organizationId: org,
        status: "autorizada",
        dataEmissao: { gte: startMonth },
      },
      _count: true,
      _sum: { valorTotal: true },
    }),
    prisma.fiscalDocument.count({
      where: {
        organizationId: org,
        status: "autorizada",
        dataEmissao: { gte: startDay },
      },
    }),
    prisma.sale.count({
      where: {
        organizationId: org,
        OR: [{ fiscalDoc: { is: null } }, { fiscalDoc: { status: "cancelada" } }],
      },
    }),
  ]);

  const page = clampPage(rawPage, salesTotal);
  const sales = await prisma.sale.findMany({
    where: { organizationId: org },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { fiscalDoc: true, customer: true },
  });

  const rows: NfceRow[] = sales.map((s) => {
    const d = s.fiscalDoc;
    const status: NfceRow["status"] = !d
      ? "pendente"
      : (d.status as "autorizada" | "cancelada");
    return {
      saleId: s.id,
      docId: d?.id ?? null,
      numero: d?.numero ?? null,
      status,
      chave: d?.chave ?? null,
      total: money(s.total),
      cliente: s.customer?.name ?? "Consumidor não identificado",
      quando: s.createdAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      simulado: Boolean(d) && !d!.provider,
      podeCancelar:
        status === "autorizada" &&
        withinCancelWindow(d!.modelo, d!.dataAutorizacao ?? d!.dataEmissao),
      prazoCancelamento:
        status === "autorizada"
          ? cancelWindowLabel(d!.modelo, d!.dataAutorizacao ?? d!.dataEmissao)
          : "",
    };
  });

  return {
    config,
    rows,
    pageMeta: pageMeta(page, salesTotal),
    kpis: {
      autorizadasMes: mes._count,
      valorMes: money(mes._sum.valorTotal),
      emitidasHoje,
      pendentes,
    },
  };
}

export { PAY_LABEL };

/**
 * Recorte do estabelecimento para a regra de prontidão. Existe para a regra
 * continuar PURA: ela recebe dado, não consulta banco.
 */
export async function getEstablishmentSnapshot(
  org: string,
): Promise<EstablishmentSnapshot> {
  return toSnapshot(await ensureFiscalConfig(org));
}

/**
 * Recorte do estabelecimento para a regra de prontidão, a partir de uma config
 * JÁ CARREGADA. Separado de `getEstablishmentSnapshot` porque `emitNfce` já tem
 * a config em mãos — reler o banco ali só para montar o mesmo objeto seria uma
 * consulta a mais em cada venda.
 */
function toSnapshot(c: FiscalCfg): EstablishmentSnapshot {
  return {
    cnpj: c.cnpj,
    razaoSocial: c.razaoSocial,
    ie: c.ie,
    inscricaoMunicipal: c.inscricaoMunicipal,
    cMun: c.cMun,
    municipio: c.municipio,
    uf: c.uf,
    cep: c.cep,
    logradouro: c.logradouro,
    numeroEnd: c.numeroEnd,
    bairro: c.bairro,
    crt: c.crt,
    cscId: c.cscId,
    csc: c.csc,
    defaultNcm: c.defaultNcm,
    provider: c.provider,
    ambiente: c.ambiente,
    certValidoAte: c.certValidoAte,
    certHabilitado: Boolean(c.focusTokenProducao || c.focusTokenHomologacao),
    respNome: c.respNome,
    respCpf: c.respCpf,
  };
}

/** Prontidão fiscal calculada a partir do cadastro atual. */
export async function getFiscalReadiness(org: string) {
  const snap = await getEstablishmentSnapshot(org);
  const docs = evaluateReadiness(snap);
  return { docs, status: overallStatus(docs) };
}
