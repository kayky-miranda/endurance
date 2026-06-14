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
  ensureFiscalConfig,
  getFiscalConfigView,
  type FiscalConfigView,
} from "./fiscal-service";

export type EmitNfeResult =
  | { ok: true; docId: string; chave: string; numero: number }
  | { ok: false; error: string };

/**
 * Emite a NF-e (modelo 55) de uma venda. Diferente da NFC-e (65), a NF-e exige
 * destinatário identificado (CPF/CNPJ). A autorização SEFAZ é simulada.
 */
export async function emitNfe(org: string, saleId: string): Promise<EmitNfeResult> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, payments: true, customer: true, fiscalDoc: true },
  });
  if (!sale || sale.organizationId !== org)
    return { ok: false, error: "Venda não encontrada." };
  if (!sale.customer?.document)
    return {
      ok: false,
      error: "A NF-e exige um cliente com CPF/CNPJ. Identifique o cliente na venda.",
    };
  if (sale.fiscalDoc) {
    if (sale.fiscalDoc.modelo === "65" && sale.fiscalDoc.status !== "cancelada")
      return { ok: false, error: "Esta venda já tem uma NFC-e emitida." };
    if (sale.fiscalDoc.modelo === "55" && sale.fiscalDoc.status !== "cancelada")
      return {
        ok: true,
        docId: sale.fiscalDoc.id,
        chave: sale.fiscalDoc.chave,
        numero: sale.fiscalDoc.numero,
      };
  }

  const cfg = await ensureFiscalConfig(org);
  if (!cfg.cnpj || !cfg.razaoSocial)
    return {
      ok: false,
      error: "Complete os dados fiscais (CNPJ e razão social) antes de emitir.",
    };

  const updated = await prisma.fiscalConfig.update({
    where: { organizationId: org },
    data: { proxNumero: { increment: 1 } },
  });
  const numero = updated.proxNumero - 1;
  const emissao = new Date();

  const chave = buildAccessKey({
    uf: cfg.uf,
    cnpj: cfg.cnpj,
    modelo: "55",
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
    dest: { nome: sale.customer.name, doc: sale.customer.document },
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
  }).replace("<mod>65</mod>", "<mod>55</mod>");
  const protocolo = buildProtocolo(cfg.uf, emissao);

  try {
    const doc = await prisma.fiscalDocument.upsert({
      where: { saleId },
      create: {
        organizationId: org,
        saleId,
        modelo: "55",
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
        modelo: "55",
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
    return { ok: false, error: "Falha ao gravar a NF-e." };
  }
}

export interface NfeRow {
  saleId: string;
  docId: string | null;
  numero: number | null;
  status: "autorizada" | "cancelada" | "pendente" | "bloqueada";
  chave: string | null;
  total: number;
  cliente: string;
  documento: string;
  quando: string;
  /** Motivo de não poder emitir (ex.: já tem NFC-e). */
  motivo?: string;
}

export interface NfeOverview {
  config: FiscalConfigView;
  rows: NfeRow[];
  pageMeta: PageMeta;
  kpis: {
    autorizadasMes: number;
    valorMes: number;
    emitidasHoje: number;
    pendentes: number;
  };
}

/** Lista as vendas elegíveis a NF-e (cliente identificado) e suas notas. */
export async function getNfeOverview(
  org: string,
  rawPage = 1,
): Promise<NfeOverview> {
  const config = await getFiscalConfigView(org);
  const eligible = {
    organizationId: org,
    customer: { document: { not: "" } },
  } as const;

  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);

  // KPIs agregados no banco (globais, não apenas da página atual).
  const [eligibleTotal, mes, emitidasHoje, pendentes] = await Promise.all([
    prisma.sale.count({ where: eligible }),
    prisma.fiscalDocument.aggregate({
      where: {
        organizationId: org,
        modelo: "55",
        status: "autorizada",
        dataEmissao: { gte: startMonth },
      },
      _count: true,
      _sum: { valorTotal: true },
    }),
    prisma.fiscalDocument.count({
      where: {
        organizationId: org,
        modelo: "55",
        status: "autorizada",
        dataEmissao: { gte: startDay },
      },
    }),
    prisma.sale.count({ where: { ...eligible, fiscalDoc: { is: null } } }),
  ]);

  const page = clampPage(rawPage, eligibleTotal);
  const sales = await prisma.sale.findMany({
    where: eligible,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { fiscalDoc: true, customer: true },
  });

  const rows: NfeRow[] = sales
    .filter((s) => s.customer?.document)
    .map((s) => {
      const d = s.fiscalDoc;
      let status: NfeRow["status"] = "pendente";
      let motivo: string | undefined;
      if (d) {
        if (d.modelo === "55") status = d.status as "autorizada" | "cancelada";
        else {
          status = "bloqueada";
          motivo = "Venda já possui NFC-e";
        }
      }
      return {
        saleId: s.id,
        docId: d?.modelo === "55" ? d.id : null,
        numero: d?.modelo === "55" ? d.numero : null,
        status,
        chave: d?.modelo === "55" ? d.chave : null,
        total: money(s.total),
        cliente: s.customer?.name ?? "—",
        documento: s.customer?.document ?? "",
        quando: s.createdAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        motivo,
      };
    });

  return {
    config,
    rows,
    pageMeta: pageMeta(page, eligibleTotal),
    kpis: {
      autorizadasMes: mes._count,
      valorMes: money(mes._sum.valorTotal),
      emitidasHoje,
      pendentes,
    },
  };
}
