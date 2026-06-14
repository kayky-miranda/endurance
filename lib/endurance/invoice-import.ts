import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { money } from "./money";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ParsedInvoice {
  chave: string;
  modelo: string;
  serie: number;
  numero: number;
  emitCnpj: string;
  emitNome: string;
  total: number;
  itemsCount: number;
  dhEmi: Date | null;
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : null;
};
const block = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
};

/** Extrai os campos principais de um XML de NF-e/NFC-e (layout 4.00). */
export function parseInvoiceXml(xml: string): ParsedInvoice | null {
  if (!xml || !/<infNFe/i.test(xml)) return null;

  // Chave: do atributo Id="NFe<44 dígitos>" ou de <chNFe>.
  let chave = "";
  const idm = xml.match(/Id\s*=\s*"NFe(\d{44})"/i);
  if (idm) chave = idm[1];
  else {
    const ch = tag(xml, "chNFe");
    if (ch && /\d{44}/.test(ch)) chave = ch.replace(/\D/g, "").slice(0, 44);
  }
  if (chave.length !== 44) return null;

  const ide = block(xml, "ide") ?? xml;
  const modelo = (tag(ide, "mod") ?? chave.slice(20, 22) ?? "55").trim();
  const serie = parseInt(tag(ide, "serie") ?? "0", 10) || 0;
  const numero = parseInt(tag(ide, "nNF") ?? "0", 10) || 0;
  const dhRaw = tag(ide, "dhEmi") ?? tag(ide, "dEmi");
  const dh = dhRaw ? new Date(dhRaw) : null;
  const dhEmi = dh && !Number.isNaN(dh.getTime()) ? dh : null;

  const emit = block(xml, "emit") ?? "";
  const emitCnpj = (tag(emit, "CNPJ") ?? "").replace(/\D/g, "");
  const emitNome = tag(emit, "xNome") ?? "";

  const totalBlock = block(xml, "ICMSTot") ?? block(xml, "total") ?? xml;
  const total = parseFloat(tag(totalBlock, "vNF") ?? "0") || 0;

  const itemsCount = (xml.match(/<det\b/gi) ?? []).length;

  return { chave, modelo, serie, numero, emitCnpj, emitNome, total, itemsCount, dhEmi };
}

export interface ParsedItem {
  cProd: string; // código do produto no fornecedor
  ean: string; // GTIN/código de barras ("" quando "SEM GTIN")
  name: string; // xProd
  qty: number; // qCom (quantidade comercial)
  unitCost: number; // vUnCom (valor unitário comercial)
}

/** Extrai os itens (<det>/<prod>) de um XML de NF-e/NFC-e (layout 4.00). */
export function parseInvoiceItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const dets = xml.match(/<det\b[^>]*>[\s\S]*?<\/det>/gi) ?? [];
  for (const det of dets) {
    const prod = block(det, "prod");
    if (!prod) continue;
    const name = (tag(prod, "xProd") ?? "").trim();
    if (!name) continue;
    let ean = (tag(prod, "cEAN") ?? "").replace(/\D/g, "");
    if (!/^\d{8,14}$/.test(ean)) ean = ""; // "SEM GTIN" / vazio
    items.push({
      cProd: (tag(prod, "cProd") ?? "").trim(),
      ean,
      name,
      qty: parseFloat(tag(prod, "qCom") ?? "0") || 0,
      unitCost: parseFloat(tag(prod, "vUnCom") ?? "0") || 0,
    });
  }
  return items;
}

export interface InvoiceFileInput {
  name: string;
  text: string;
}

export interface InvoicePreviewRow {
  name: string;
  ok: boolean;
  error?: string;
  chave?: string;
  modelo?: string;
  numero?: number;
  emitNome?: string;
  total?: number;
  itemsCount?: number;
  duplicate?: boolean;
}

export async function previewInvoices(
  org: string,
  files: InvoiceFileInput[],
): Promise<InvoicePreviewRow[]> {
  const existing = new Set(
    (
      await prisma.importedInvoice.findMany({
        where: { organizationId: org },
        select: { chave: true },
      })
    ).map((i) => i.chave),
  );
  const seen = new Set<string>();
  const rows: InvoicePreviewRow[] = [];
  for (const f of files) {
    const p = parseInvoiceXml(f.text);
    if (!p) {
      rows.push({ name: f.name, ok: false, error: "XML inválido ou não é NF-e/NFC-e." });
      continue;
    }
    const duplicate = existing.has(p.chave) || seen.has(p.chave);
    seen.add(p.chave);
    rows.push({
      name: f.name,
      ok: true,
      duplicate,
      chave: p.chave,
      modelo: p.modelo,
      numero: p.numero,
      emitNome: p.emitNome,
      total: p.total,
      itemsCount: p.itemsCount,
      error: duplicate ? "Nota já importada (será ignorada)." : undefined,
    });
  }
  return rows;
}

export interface CommitOptions {
  /** Dar entrada no estoque dos itens (default true). */
  applyStock?: boolean;
  /** Gerar uma conta a pagar com o total da nota (default true). */
  applyPayable?: boolean;
  /** Criar produtos que ainda não existem no catálogo (default true). */
  createProducts?: boolean;
}

export interface CommitInvoicesResult {
  ok: true;
  imported: number;
  skipped: number;
  /** Itens que deram entrada no estoque (atualizados + criados). */
  stockUpdated: number;
  /** Produtos novos criados a partir das notas. */
  productsCreated: number;
  /** Contas a pagar geradas. */
  payables: number;
}

/** Índice em memória dos produtos do espaço para casar itens da nota. */
interface ProductIndex {
  byBarcode: Map<string, string>;
  bySku: Map<string, string>;
  byName: Map<string, string>;
}

async function loadProductIndex(org: string): Promise<ProductIndex> {
  const products = await prisma.product.findMany({
    where: { organizationId: org },
    select: { id: true, name: true, barcode: true, sku: true },
  });
  const idx: ProductIndex = {
    byBarcode: new Map(),
    bySku: new Map(),
    byName: new Map(),
  };
  for (const p of products) indexProduct(idx, p);
  return idx;
}

function indexProduct(
  idx: ProductIndex,
  p: { id: string; name: string; barcode: string; sku: string },
) {
  if (p.barcode) idx.byBarcode.set(p.barcode, p.id);
  if (p.sku) idx.bySku.set(p.sku, p.id);
  if (p.name) idx.byName.set(p.name.toLowerCase(), p.id);
}

/** Casa um item da nota a um produto: GTIN → código do fornecedor → nome. */
function matchProduct(idx: ProductIndex, it: ParsedItem): string | null {
  return (
    (it.ean && idx.byBarcode.get(it.ean)) ||
    (it.cProd && idx.bySku.get(it.cProd)) ||
    idx.byName.get(it.name.toLowerCase()) ||
    null
  );
}

/**
 * Importa NF-e/NFC-e por XML, opcionalmente lançando os efeitos da nota de
 * ENTRADA: entrada no estoque dos itens e uma conta a pagar com o total.
 *
 * Idempotente por chave de acesso: cada nota é registrada uma única vez e seus
 * lançamentos só ocorrem nessa primeira importação. Cada nota é processada em
 * uma transação (estoque + financeiro + registro), tudo-ou-nada.
 */
export async function commitInvoices(
  org: string,
  files: InvoiceFileInput[],
  options: CommitOptions = {},
): Promise<CommitInvoicesResult> {
  const applyStock = options.applyStock !== false;
  const applyPayable = options.applyPayable !== false;
  const createProducts = options.createProducts !== false;

  const existing = new Set(
    (
      await prisma.importedInvoice.findMany({
        where: { organizationId: org },
        select: { chave: true },
      })
    ).map((i) => i.chave),
  );

  const idx = applyStock ? await loadProductIndex(org) : null;

  let imported = 0;
  let skipped = 0;
  let stockUpdated = 0;
  let productsCreated = 0;
  let payables = 0;
  const seen = new Set<string>();

  for (const f of files) {
    const p = parseInvoiceXml(f.text);
    if (!p || seen.has(p.chave) || existing.has(p.chave)) {
      skipped++;
      continue;
    }
    seen.add(p.chave);

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let noteStock = 0;
    let noteCreated = 0;
    // Identificadores dos produtos criados nesta nota, para reindexar depois.
    const createdKeys: { barcode: string; name: string }[] = [];

    if (applyStock && idx) {
      // Soma quantidades por produto-alvo (uma nota pode repetir o item).
      const agg = new Map<string, { it: ParsedItem; qty: number }>();
      for (const it of parseInvoiceItems(f.text)) {
        const qtyInt = Math.max(0, Math.round(it.qty));
        if (qtyInt <= 0) continue;
        const key = it.ean || it.cProd || it.name.toLowerCase();
        const cur = agg.get(key);
        if (cur) cur.qty += qtyInt;
        else agg.set(key, { it, qty: qtyInt });
      }
      for (const { it, qty } of agg.values()) {
        const productId = matchProduct(idx, it);
        if (productId) {
          ops.push(
            prisma.product.update({
              where: { id: productId },
              data: {
                stock: { increment: qty },
                ...(it.unitCost > 0 ? { cost: round2(it.unitCost) } : {}),
              },
            }),
          );
          noteStock++;
        } else if (createProducts) {
          ops.push(
            prisma.product.create({
              data: {
                organizationId: org,
                name: it.name.slice(0, 120),
                barcode: it.ean,
                sku: it.cProd.slice(0, 40),
                cost: round2(it.unitCost),
                price: 0,
                stock: qty,
              },
            }),
          );
          noteStock++;
          noteCreated++;
          createdKeys.push({ barcode: it.ean, name: it.name.slice(0, 120) });
        }
      }
    }

    const notePayable = applyPayable && p.total > 0;
    if (notePayable) {
      const due = new Date();
      due.setDate(due.getDate() + 28);
      const label = p.modelo === "65" ? "NFC-e" : "NF-e";
      ops.push(
        prisma.financialEntry.create({
          data: {
            organizationId: org,
            kind: "pagar",
            description: `${label} ${p.numero} · ${p.emitNome || "Fornecedor"}`.slice(0, 120),
            category: "Mercadorias",
            amount: p.total,
            status: "pendente",
            dueDate: due,
          },
        }),
      );
    }

    ops.push(
      prisma.importedInvoice.create({
        data: {
          organizationId: org,
          chave: p.chave,
          modelo: p.modelo,
          serie: p.serie,
          numero: p.numero,
          emitCnpj: p.emitCnpj,
          emitNome: p.emitNome,
          total: p.total,
          itemsCount: p.itemsCount,
          dhEmi: p.dhEmi ?? new Date(),
          xml: f.text.slice(0, 200000),
          appliedStock: noteStock > 0,
          appliedPayable: notePayable,
        },
      }),
    );

    try {
      await prisma.$transaction(ops);
      imported++;
      stockUpdated += noteStock;
      productsCreated += noteCreated;
      if (notePayable) payables++;
      // Reindexa os produtos recém-criados para que outras notas do mesmo lote
      // deem ENTRADA neles em vez de duplicar o cadastro.
      if (idx && createdKeys.length > 0) {
        const fresh = await prisma.product.findMany({
          where: {
            organizationId: org,
            OR: [
              { barcode: { in: createdKeys.map((k) => k.barcode).filter(Boolean) } },
              { name: { in: createdKeys.map((k) => k.name) } },
            ],
          },
          select: { id: true, name: true, barcode: true, sku: true },
        });
        for (const fp of fresh) indexProduct(idx, fp);
      }
    } catch {
      skipped++;
    }
  }
  return { ok: true, imported, skipped, stockUpdated, productsCreated, payables };
}

export interface ImportedInvoiceRow {
  id: string;
  chave: string;
  modelo: string;
  numero: number;
  emitNome: string;
  total: number;
  itemsCount: number;
  dhEmi: string;
  appliedStock: boolean;
  appliedPayable: boolean;
}

export async function getImportedInvoices(
  org: string,
): Promise<ImportedInvoiceRow[]> {
  const rows = await prisma.importedInvoice.findMany({
    where: { organizationId: org },
    orderBy: { dhEmi: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    chave: r.chave,
    modelo: r.modelo,
    numero: r.numero,
    emitNome: r.emitNome || "—",
    total: money(r.total),
    itemsCount: r.itemsCount,
    dhEmi: r.dhEmi.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    appliedStock: r.appliedStock,
    appliedPayable: r.appliedPayable,
  }));
}
