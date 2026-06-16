"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  generateFromQuotation,
  sendOrder,
  confirmOrder,
  cancelOrder,
  getOrderDetail,
  type PoDetail,
} from "@/lib/endurance/purchase-orders";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

export async function loadOrderAction(
  id: string,
): Promise<{ ok: boolean; error?: string; detail?: PoDetail }> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const detail = await getOrderDetail(gate.session.org, id);
  if (!detail) return { ok: false, error: "Pedido não encontrado." };
  return { ok: true, detail };
}

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/pedidos_compra`);
}

export async function generateOrderAction(
  quotationId: string,
): Promise<R & { id?: string }> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await generateFromQuotation(s.org, quotationId);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/m/cotacoes`);
    await logActivity(
      s,
      "purchaseorder.create",
      "Gerou pedido de compra a partir da cotação vencedora",
      res.id,
    );
  }
  return res;
}

export async function sendOrderAction(id: string, via: string): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await sendOrder(s.org, id, via);
  if (res.ok) {
    rev(s.slug);
    revalidatePath(`/espaco/${s.slug}/pedido/${id}`);
    await logActivity(
      s,
      "purchaseorder.send",
      `Enviou pedido ao fornecedor${via ? ` via ${via}` : ""}`,
      id,
    );
  }
  return res;
}

export async function confirmOrderAction(id: string): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await confirmOrder(s.org, id);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "purchaseorder.confirm", "Confirmou pedido de compra", id);
  }
  return res;
}

export async function cancelOrderAction(id: string): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await cancelOrder(s.org, id);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "purchaseorder.cancel", "Cancelou pedido de compra", id);
  }
  return res;
}
