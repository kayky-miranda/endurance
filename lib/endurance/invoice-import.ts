import "server-only";
import { prisma } from "@/lib/db";

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

export async function commitInvoices(
  org: string,
  files: InvoiceFileInput[],
): Promise<{ ok: boolean; imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const seen = new Set<string>();
  for (const f of files) {
    const p = parseInvoiceXml(f.text);
    if (!p || seen.has(p.chave)) {
      skipped++;
      continue;
    }
    seen.add(p.chave);
    try {
      await prisma.importedInvoice.upsert({
        where: { organizationId_chave: { organizationId: org, chave: p.chave } },
        create: {
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
        },
        update: {},
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, imported, skipped };
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
    total: r.total,
    itemsCount: r.itemsCount,
    dhEmi: r.dhEmi.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  }));
}
