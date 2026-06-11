import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import {
  buildAccessKey,
  buildQrCode,
  buildNfceXml,
  buildProtocolo,
  randomCNF,
} from "./fiscal";

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

/**
 * Emite a NFC-e de uma venda: reserva o número (incremento atômico), monta a
 * chave/QR/XML e grava o documento. A autorização SEFAZ é simulada (protocolo).
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
      where: { saleId },
      create: {
        organizationId: org,
        saleId,
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
  kpis: {
    autorizadasMes: number;
    valorMes: number;
    emitidasHoje: number;
    pendentes: number;
  };
}

export async function getNfceOverview(org: string): Promise<NfceOverview> {
  const config = await getFiscalConfigView(org);
  const sales = await prisma.sale.findMany({
    where: { organizationId: org },
    orderBy: { createdAt: "desc" },
    take: 40,
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

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);

  const docs = await prisma.fiscalDocument.findMany({
    where: { organizationId: org, status: "autorizada" },
    select: { valorTotal: true, dataEmissao: true },
  });
  const mes = docs.filter((d) => d.dataEmissao >= startMonth);
  const kpis = {
    autorizadasMes: mes.length,
    valorMes: mes.reduce((a, d) => a + money(d.valorTotal), 0),
    emitidasHoje: docs.filter((d) => d.dataEmissao >= startDay).length,
    pendentes: rows.filter((r) => r.status === "pendente").length,
  };

  return { config, rows, kpis };
}

export { PAY_LABEL };
