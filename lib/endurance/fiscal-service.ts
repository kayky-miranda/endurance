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
} from "./fiscal-provider";
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
}

/** Lê a config fiscal; cria uma padrão (a partir da org) se ainda não existir. */
export async function ensureFiscalConfig(org: string) {
  const existing = await prisma.fiscalConfig.findUnique({
    where: { organizationId: org },
  });
  if (existing) return existing;
  const o = await prisma.organization.findUnique({ where: { id: org } });
  return prisma.fiscalConfig.create({
    data: {
      organizationId: org,
      razaoSocial: o?.name ?? "",
      nomeFantasia: o?.name ?? "",
      uf: (o?.state || "SP").toUpperCase().slice(0, 2),
      municipio: o?.city ?? "",
    },
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

  const resolution = resolveFiscalProvider(cfg);
  if (resolution.kind === "error") return { ok: false, error: resolution.error };
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
async function emitNfceViaProvider(
  org: string,
  sale: SaleWithRelations,
  cfg: FiscalCfg,
  ambiente: FiscalAmbiente,
  provider: FiscalProvider,
): Promise<EmitResult> {
  const ncm = (cfg.defaultNcm ?? "").replace(/\D/g, "");
  if (ncm.length !== 8)
    return {
      ok: false,
      error:
        "Configure o NCM padrão (8 dígitos) dos produtos antes de emitir com o provedor real.",
    };

  const emissao = new Date();
  const input: NfceEmitInput = {
    ref: sale.id,
    ambiente,
    emissao,
    emit: { cnpj: cfg.cnpj, ie: cfg.ie, crt: cfg.crt, uf: cfg.uf },
    dest: sale.customer?.document
      ? { nome: sale.customer.name, doc: sale.customer.document }
      : null,
    itens: sale.items.map((it) => ({
      codigo: it.productId ?? "",
      descricao: it.name,
      ncm,
      cfop: "5102",
      unidade: "UN",
      quantidade: it.quantity,
      valorUnitario: money(it.unitPrice),
    })),
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
    xml: "",
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
    if (!c.ok)
      return { ok: false, error: c.mensagem ?? "Falha ao cancelar na SEFAZ." };
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
