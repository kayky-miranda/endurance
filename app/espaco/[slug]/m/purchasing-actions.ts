"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  createSupplier,
  createPurchaseOrder,
  receivePurchaseOrder,
  markOrderSent,
  type POItemInput,
} from "@/lib/endurance/purchasing";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/fornecedores`);
}

export async function createSupplierAction(input: {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
}): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createSupplier(s.org, input);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "supplier.create",
      `Cadastrou o fornecedor ${(input.name ?? "").trim().slice(0, 80)}`,
    );
  }
  return res;
}

export async function createPurchaseOrderAction(
  supplierId: string,
  items: POItemInput[],
  note: string,
): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createPurchaseOrder(s.org, supplierId, items, note);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "purchase.create",
      `Criou pedido de compra com ${(items ?? []).length} item(ns)`,
      supplierId,
    );
  }
  return res;
}

export async function markOrderSentAction(
  orderId: string,
  via: string,
): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await markOrderSent(s.org, orderId, via);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/pedido/${orderId}`);
    await logActivity(
      s,
      "purchase.sent",
      `Enviou pedido de compra ao fornecedor${via ? ` via ${via.trim().slice(0, 40)}` : ""}`,
      orderId,
    );
  }
  return res;
}

export async function receivePurchaseOrderAction(orderId: string): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await receivePurchaseOrder(s.org, orderId);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(
      s,
      "purchase.receive",
      "Recebeu pedido de compra (estoque atualizado)",
      orderId,
    );
  }
  return res;
}
