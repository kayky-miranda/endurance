"use server";

import { revalidatePath } from "next/cache";
import { getSession, canManageTeam } from "@/lib/auth";
import {
  createSupplier,
  createPurchaseOrder,
  receivePurchaseOrder,
  markOrderSent,
  type POItemInput,
} from "@/lib/endurance/purchasing";

type R = { ok: boolean; error?: string };

const DENIED: R = { ok: false, error: "Acesso restrito a administradores." };

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/fornecedores`);
}

export async function createSupplierAction(input: {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
}): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await createSupplier(s.org, input);
  if (res.ok) rev(s.slug);
  return res;
}

export async function createPurchaseOrderAction(
  supplierId: string,
  items: POItemInput[],
  note: string,
): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await createPurchaseOrder(s.org, supplierId, items, note);
  if (res.ok) rev(s.slug);
  return res;
}

export async function markOrderSentAction(
  orderId: string,
  via: string,
): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await markOrderSent(s.org, orderId, via);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/pedido/${orderId}`);
  }
  return res;
}

export async function receivePurchaseOrderAction(orderId: string): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role)) return DENIED;
  const res = await receivePurchaseOrder(s.org, orderId);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  }
  return res;
}
