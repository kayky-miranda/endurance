"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { applyStockMovement } from "@/lib/endurance/stock-ledger";

/**
 * Importação por planilha (CSV): produtos e clientes. As linhas chegam já
 * mapeadas (key → valor) pelo CsvImportModal; aqui cada linha passa por Zod,
 * é feito UPSERT (chave natural: código de barras/SKU p/ produto, documento/
 * e-mail p/ cliente) e o estoque inicial entra pelo RAZÃO (auditável).
 */

const MAX_ROWS = 5000;

type ImportResult = {
  ok: boolean;
  created?: number;
  updated?: number;
  errors?: string[];
  error?: string;
};

// Números BR: "1.234,56" → 1234.56; também aceita "1234.56".
const brNumber = (raw: string): number => {
  const s = raw.trim();
  if (!s) return 0;
  const norm =
    s.includes(",") && (s.lastIndexOf(",") > s.lastIndexOf("."))
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  const n = Number(norm.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const ProductRow = z.object({
  name: z.string().trim().min(1, "nome vazio").max(120),
  barcode: z.string().trim().max(20).optional().default(""),
  sku: z.string().trim().max(40).optional().default(""),
  category: z.string().trim().max(40).optional().default(""),
  unit: z.string().trim().max(10).optional().default(""),
  ncm: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 8, "NCM deve ter 8 dígitos")
    .optional()
    .default(""),
  price: z.string().optional().default(""),
  cost: z.string().optional().default(""),
  stock: z.string().optional().default(""),
});

export async function importProductsCsvAction(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const gate = await requirePermission("products.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  if (!Array.isArray(rows) || rows.length === 0)
    return { ok: false, error: "Nenhuma linha para importar." };
  if (rows.length > MAX_ROWS)
    return { ok: false, error: "Limite de 5.000 linhas por importação." };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = ProductRow.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Linha ${i + 2}: ${parsed.error.issues[0]?.message ?? "inválida"}`);
      continue;
    }
    const r = parsed.data;
    const price = Math.max(0, brNumber(r.price));
    const cost = Math.max(0, brNumber(r.cost));
    const stock = Math.max(0, Math.trunc(brNumber(r.stock)));

    try {
      // Chave natural: código de barras; senão SKU; senão nome exato.
      const existing = await prisma.product.findFirst({
        where: {
          organizationId: s.org,
          OR: [
            ...(r.barcode ? [{ barcode: r.barcode }] : []),
            ...(r.sku ? [{ sku: r.sku }] : []),
            ...(!r.barcode && !r.sku ? [{ name: r.name }] : []),
          ],
        },
        select: { id: true },
      });

      if (existing) {
        // Atualiza SÓ dados cadastrais/preço — estoque nunca muda por import
        // de atualização (a origem auditável do saldo é o razão).
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: r.name,
            ...(r.barcode ? { barcode: r.barcode } : {}),
            ...(r.sku ? { sku: r.sku } : {}),
            ...(r.category ? { category: r.category } : {}),
            ...(r.unit ? { unit: r.unit } : {}),
            ...(r.ncm ? { ncm: r.ncm } : {}),
            ...(r.price !== "" ? { price } : {}),
            ...(r.cost !== "" ? { cost } : {}),
          },
        });
        updated++;
      } else {
        await prisma.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              organizationId: s.org,
              name: r.name,
              barcode: r.barcode,
              sku: r.sku,
              category: r.category,
              unit: r.unit || "un",
              ncm: r.ncm,
              price,
              cost,
              stock: 0,
            },
          });
          if (stock > 0)
            await applyStockMovement(tx, {
              organizationId: s.org,
              productId: p.id,
              delta: stock,
              reason: "saldo_inicial",
              refType: "import_csv",
              actor: { id: s.sub, name: s.name },
            });
        });
        created++;
      }
    } catch {
      errors.push(`Linha ${i + 2}: erro ao gravar (código de barras duplicado?)`);
    }
  }

  await logActivity(
    s,
    "product.import",
    `Importou planilha de produtos: ${created} criado(s), ${updated} atualizado(s), ${errors.length} erro(s)`,
  );
  revalidatePath(`/espaco/${s.slug}/m/produtos`);
  revalidatePath(`/espaco/${s.slug}/m/estoque`);
  return { ok: true, created, updated, errors };
}

const CustomerRow = z.object({
  name: z.string().trim().min(1, "nome vazio").max(80),
  phone: z.string().trim().max(20).optional().default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((e) => e === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "e-mail inválido")
    .optional()
    .default(""),
  document: z.string().trim().max(20).optional().default(""),
});

export async function importCustomersCsvAction(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const gate = await requirePermission("customers.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  if (!Array.isArray(rows) || rows.length === 0)
    return { ok: false, error: "Nenhuma linha para importar." };
  if (rows.length > MAX_ROWS)
    return { ok: false, error: "Limite de 5.000 linhas por importação." };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = CustomerRow.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Linha ${i + 2}: ${parsed.error.issues[0]?.message ?? "inválida"}`);
      continue;
    }
    const r = parsed.data;
    try {
      const existing = await prisma.customer.findFirst({
        where: {
          organizationId: s.org,
          OR: [
            ...(r.document ? [{ document: r.document }] : []),
            ...(r.email ? [{ email: r.email }] : []),
            ...(!r.document && !r.email ? [{ name: r.name, phone: r.phone }] : []),
          ],
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: r.name,
            ...(r.phone ? { phone: r.phone } : {}),
            ...(r.email ? { email: r.email } : {}),
            ...(r.document ? { document: r.document } : {}),
          },
        });
        updated++;
      } else {
        await prisma.customer.create({
          data: {
            organizationId: s.org,
            name: r.name,
            phone: r.phone,
            email: r.email,
            document: r.document,
          },
        });
        created++;
      }
    } catch {
      errors.push(`Linha ${i + 2}: erro ao gravar`);
    }
  }

  await logActivity(
    s,
    "customer.import",
    `Importou planilha de clientes: ${created} criado(s), ${updated} atualizado(s), ${errors.length} erro(s)`,
  );
  revalidatePath(`/espaco/${s.slug}/m/crm`);
  return { ok: true, created, updated, errors };
}
