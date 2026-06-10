import "server-only";
import { prisma } from "@/lib/db";
import { importSpec, type ImportEntitySpec } from "./import-spec";

const norm = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();

function parseNumber(s: string): number | null {
  if (!s || !s.trim()) return null;
  let t = s.trim().replace(/\s/g, "").replace(/R\$/i, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDate(s: string): Date | null {
  const t = (s ?? "").trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)))
    return new Date(+m[3], +m[2] - 1, +m[1], 12);
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)))
    return new Date(+m[1], +m[2] - 1, +m[3], 12);
  return null;
}

/** Parser CSV simples: detecta separador (; ou ,), respeita aspas. */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const sep =
    firstLine.split(";").length >= firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQ) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface AnalyzedRow {
  line: number;
  obj: Record<string, string>;
  errors: string[];
}

interface Ctx {
  bySku: Map<string, { id: string }>;
  byBarcode: Map<string, { id: string }>;
}

async function buildCtx(org: string, entityId: string): Promise<Ctx> {
  const ctx: Ctx = { bySku: new Map(), byBarcode: new Map() };
  if (entityId === "estoque" || entityId === "precos") {
    const products = await prisma.product.findMany({
      where: { organizationId: org },
      select: { id: true, sku: true, barcode: true },
    });
    for (const p of products) {
      if (p.sku) ctx.bySku.set(norm(p.sku), { id: p.id });
      if (p.barcode) ctx.byBarcode.set(p.barcode.trim(), { id: p.id });
    }
  }
  return ctx;
}

function matchProduct(obj: Record<string, string>, ctx: Ctx): string | null {
  const sku = (obj.sku ?? "").trim();
  const barcode = (obj.barcode ?? "").trim();
  if (sku && ctx.bySku.has(norm(sku))) return ctx.bySku.get(norm(sku))!.id;
  if (barcode && ctx.byBarcode.has(barcode))
    return ctx.byBarcode.get(barcode)!.id;
  return null;
}

function validateRow(
  spec: ImportEntitySpec,
  obj: Record<string, string>,
  ctx: Ctx,
): string[] {
  const errors: string[] = [];
  for (const col of spec.columns) {
    const raw = (obj[col.key] ?? "").trim();
    if (!raw) {
      if (col.required) errors.push(`${col.label} é obrigatório`);
      continue;
    }
    if (col.kind === "number" && parseNumber(raw) === null)
      errors.push(`${col.label} inválido (use número, ex.: 29,90)`);
    if (col.kind === "int") {
      const n = parseNumber(raw);
      if (n === null || !Number.isInteger(n))
        errors.push(`${col.label} deve ser um número inteiro`);
    }
    if (col.kind === "date" && !parseDate(raw))
      errors.push(`${col.label} inválido (use dd/mm/aaaa)`);
    if (col.kind === "enum" && !col.enumValues?.includes(norm(raw)))
      errors.push(`${col.label} deve ser: ${col.enumValues?.join(" ou ")}`);
  }
  // Regras específicas de entidade.
  if (spec.id === "estoque" || spec.id === "precos") {
    if (!(obj.sku ?? "").trim() && !(obj.barcode ?? "").trim())
      errors.push("Informe SKU ou código de barras");
    else if (!matchProduct(obj, ctx))
      errors.push("Produto não encontrado no catálogo");
  }
  return errors;
}

async function analyze(
  org: string,
  entityId: string,
  text: string,
): Promise<{ spec: ImportEntitySpec; rows: AnalyzedRow[]; ctx: Ctx } | null> {
  const spec = importSpec(entityId);
  if (!spec || !spec.available) return null;
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { spec, rows: [], ctx: await buildCtx(org, entityId) };

  const headers = matrix[0].map(norm);
  // Mapeia cada coluna do spec para o índice do cabeçalho correspondente.
  const colIndex = new Map<string, number>();
  for (const col of spec.columns) {
    const idx = headers.findIndex(
      (h) => h === norm(col.label) || h === norm(col.key),
    );
    if (idx >= 0) colIndex.set(col.key, idx);
  }

  const ctx = await buildCtx(org, entityId);
  const rows: AnalyzedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const obj: Record<string, string> = {};
    for (const col of spec.columns) {
      const idx = colIndex.get(col.key);
      obj[col.key] = idx !== undefined ? (cells[idx] ?? "").trim() : "";
    }
    rows.push({ line: r + 1, obj, errors: validateRow(spec, obj, ctx) });
  }
  return { spec, rows, ctx };
}

export interface ValidateResult {
  ok: boolean;
  error?: string;
  columns?: { key: string; label: string }[];
  preview?: AnalyzedRow[];
  total?: number;
  validCount?: number;
  errorCount?: number;
}

export async function validateImport(
  org: string,
  entityId: string,
  text: string,
): Promise<ValidateResult> {
  const a = await analyze(org, entityId, text);
  if (!a) return { ok: false, error: "Tipo de importação indisponível." };
  const errorCount = a.rows.filter((r) => r.errors.length > 0).length;
  return {
    ok: true,
    columns: a.spec.columns.map((c) => ({ key: c.key, label: c.label })),
    preview: a.rows.slice(0, 60),
    total: a.rows.length,
    validCount: a.rows.length - errorCount,
    errorCount,
  };
}

export interface CommitResult {
  ok: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
}

export async function commitImport(
  org: string,
  entityId: string,
  text: string,
): Promise<CommitResult> {
  const a = await analyze(org, entityId, text);
  if (!a) return { ok: false, error: "Tipo de importação indisponível." };

  let imported = 0;
  let skipped = 0;
  for (const row of a.rows) {
    if (row.errors.length > 0) {
      skipped++;
      continue;
    }
    try {
      await commitRow(org, entityId, row.obj, a.ctx);
      imported++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, imported, skipped };
}

async function commitRow(
  org: string,
  entityId: string,
  o: Record<string, string>,
  ctx: Ctx,
): Promise<void> {
  const digits = (s: string) => (s ?? "").replace(/\D/g, "");
  switch (entityId) {
    case "fornecedores":
      await prisma.supplier.create({
        data: {
          organizationId: org,
          name: o.name.trim(),
          cnpj: digits(o.cnpj),
          phone: (o.phone ?? "").trim(),
          email: (o.email ?? "").trim(),
        },
      });
      return;
    case "produtos": {
      const category = (o.category ?? "").trim();
      await prisma.product.create({
        data: {
          organizationId: org,
          name: o.name.trim(),
          sku: (o.sku ?? "").trim(),
          barcode: (o.barcode ?? "").trim(),
          category,
          price: parseNumber(o.price) ?? 0,
          cost: parseNumber(o.cost) ?? 0,
          stock: Math.trunc(parseNumber(o.stock) ?? 0),
        },
      });
      if (category)
        await prisma.category
          .create({ data: { organizationId: org, name: category } })
          .catch(() => {});
      return;
    }
    case "clientes":
      await prisma.customer.create({
        data: {
          organizationId: org,
          name: o.name.trim(),
          phone: (o.phone ?? "").trim(),
          email: (o.email ?? "").trim(),
          document: (o.document ?? "").trim(),
        },
      });
      return;
    case "categorias":
      await prisma.category.upsert({
        where: { organizationId_name: { organizationId: org, name: o.name.trim() } },
        create: { organizationId: org, name: o.name.trim() },
        update: {},
      });
      return;
    case "estoque": {
      const id = matchProduct(o, ctx);
      if (!id) throw new Error("no match");
      await prisma.product.update({
        where: { id },
        data: { stock: Math.trunc(parseNumber(o.stock) ?? 0) },
      });
      return;
    }
    case "precos": {
      const id = matchProduct(o, ctx);
      if (!id) throw new Error("no match");
      const cost = parseNumber(o.cost);
      await prisma.product.update({
        where: { id },
        data: {
          price: parseNumber(o.price) ?? 0,
          ...(cost !== null ? { cost } : {}),
        },
      });
      return;
    }
    case "financeiro":
      await prisma.financialEntry.create({
        data: {
          organizationId: org,
          kind: norm(o.kind) === "pagar" ? "pagar" : "receber",
          description: o.description.trim(),
          category: (o.category ?? "").trim() || "Importado",
          amount: parseNumber(o.amount) ?? 0,
          status: "pendente",
          dueDate: parseDate(o.dueDate) ?? new Date(),
        },
      });
      return;
  }
}
