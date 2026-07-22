"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createCount,
  addItem,
  scanItem,
  removeItem,
  setCounted,
  transition,
  adjustCount,
  type CountType,
  type ScannedItem,
} from "@/lib/endurance/stock-count";

type R = { ok: boolean; error?: string; id?: string };

function revalidate(slug: string, countId?: string) {
  revalidatePath(`/espaco/${slug}/m/conferencia`);
  if (countId) revalidatePath(`/espaco/${slug}/m/conferencia/${countId}`);
  revalidatePath(`/espaco/${slug}/m/estoque`);
}

const VALID_TYPES: CountType[] = ["geral", "parcial", "ciclica", "localizacao"];

export async function createCountAction(input: {
  type: string;
  location?: string;
  responsibleId?: string;
  note?: string;
  blind?: boolean;
  locationId?: string;
  autoLoad?: boolean;
  categoryFilter?: string;
}): Promise<R> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const type = VALID_TYPES.includes(input.type as CountType)
    ? (input.type as CountType)
    : "geral";

  // Resolve o nome do responsável (default: quem cria).
  let responsibleId = input.responsibleId || s.sub;
  let responsibleName = s.name;
  if (responsibleId && responsibleId !== s.sub) {
    const u = await prisma.user.findFirst({
      where: { id: responsibleId, organizationId: s.org },
      select: { name: true },
    });
    if (!u) {
      responsibleId = s.sub;
      responsibleName = s.name;
    } else responsibleName = u.name;
  }

  const res = await createCount({
    org: s.org,
    type,
    location: input.location,
    responsibleId,
    responsibleName,
    note: input.note,
    blind: Boolean(input.blind),
    locationId: input.locationId || undefined,
    createdBy: { id: s.sub, name: s.name },
    // "geral" carrega tudo; "ciclica" pode filtrar por categoria.
    autoLoad: input.autoLoad ?? type === "geral",
    categoryFilter: input.categoryFilter,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await logActivity(
    s,
    "stock_count.create",
    `Criou a conferência ${res.number} (${type})`,
    res.id,
  );
  revalidate(s.slug, res.id);
  return { ok: true, id: res.id };
}

/** Busca produtos por código, SKU, descrição ou código de barras (para adicionar). */
export async function searchProductsAction(
  query: string,
): Promise<{
  ok: boolean;
  products?: { id: string; name: string; barcode: string; sku: string; stock: number }[];
  error?: string;
}> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  const q = query.trim();
  if (!q) return { ok: true, products: [] };

  const rows = await prisma.product.findMany({
    where: {
      organizationId: s.org,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { sku: { contains: q, mode: "insensitive" } },
        { id: q },
      ],
    },
    orderBy: { name: "asc" },
    take: 15,
    select: { id: true, name: true, barcode: true, sku: true, stock: true },
  });
  return { ok: true, products: rows };
}

export async function addItemAction(
  countId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string; item?: ScannedItem }> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  const res = await addItem(s.org, countId, productId);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/conferencia`);
  return res;
}

/**
 * Leitura por scanner (hands-free): identifica o produto pelo código, INCREMENTA
 * a quantidade conferida (+1) e devolve o item atualizado para a UI refletir sem
 * recarregar. Revalida só o dashboard (leve) — a tela usa o item retornado.
 */
export async function scanCountAction(
  countId: string,
  barcode: string,
): Promise<
  | { ok: true; item: ScannedItem; created: boolean }
  | { ok: false; error: string; notFound?: boolean }
> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;
  const res = await scanItem(s.org, countId, barcode);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/conferencia`);
  return res;
}

export async function removeItemAction(countId: string, itemId: string): Promise<R> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await removeItem(s.org, countId, itemId);
  if (res.ok) revalidate(s.slug, countId);
  return res;
}

export async function setCountedAction(
  countId: string,
  itemId: string,
  countedQty: number | null,
  note?: string,
): Promise<R> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setCounted(s.org, countId, itemId, countedQty, note);
  if (res.ok) revalidate(s.slug, countId);
  return res;
}

/** Rascunho/Em conferência → Aguardando aprovação. */
export async function finalizeCountAction(countId: string): Promise<R> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  // Exige ao menos um item contado para finalizar.
  const counted = await prisma.stockCountItem.count({
    where: { stockCountId: countId, countedQty: { not: null } },
  });
  if (counted === 0)
    return { ok: false, error: "Conte ao menos um item antes de finalizar." };

  const res = await transition(s.org, countId, "aguardando_aprovacao", {
    id: s.sub,
    name: s.name,
  });
  if (!res.ok) return res;
  await logActivity(s, "stock_count.finalize", "Finalizou a conferência para aprovação", countId);
  revalidate(s.slug, countId);
  return { ok: true };
}

/** Aguardando aprovação → Aprovada (não mexe no estoque ainda). */
export async function approveCountAction(countId: string): Promise<R> {
  const gate = await requirePermission("count.approve");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await transition(s.org, countId, "aprovada", { id: s.sub, name: s.name });
  if (!res.ok) return res;
  await logActivity(s, "stock_count.approve", "Aprovou as divergências da conferência", countId);
  revalidate(s.slug, countId);
  return { ok: true };
}

/** Devolve para recontagem (Aguardando → Em conferência). */
export async function reopenCountAction(countId: string): Promise<R> {
  const gate = await requirePermission("count.approve");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await transition(s.org, countId, "em_conferencia", { id: s.sub, name: s.name });
  if (!res.ok) return res;
  await logActivity(s, "stock_count.reopen", "Devolveu a conferência para recontagem", countId);
  revalidate(s.slug, countId);
  return { ok: true };
}

/** Aprovada → Ajustada: aplica o ajuste real no estoque (pelo razão). */
export async function adjustCountAction(countId: string): Promise<R> {
  const gate = await requirePermission("count.approve");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await adjustCount(s.org, countId, { id: s.sub, name: s.name });
  if (!res.ok) return { ok: false, error: res.error };
  await logActivity(
    s,
    "stock_count.adjust",
    `Efetivou o ajuste de inventário (${res.adjusted} item(ns) divergente(s))`,
    countId,
  );
  revalidate(s.slug, countId);
  return { ok: true };
}

export async function cancelCountAction(countId: string): Promise<R> {
  const gate = await requirePermission("count.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await transition(s.org, countId, "cancelada", { id: s.sub, name: s.name });
  if (!res.ok) return res;
  await logActivity(s, "stock_count.cancel", "Cancelou a conferência", countId);
  revalidate(s.slug, countId);
  return { ok: true };
}

