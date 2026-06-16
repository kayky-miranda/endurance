"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  receiveOrder,
  getReceivingTarget,
  getOrderReceipts,
  type ReceiveLine,
  type ReceivingTarget,
} from "@/lib/endurance/receiving";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

export async function loadReceivingTargetAction(orderId: string): Promise<{
  ok: boolean;
  error?: string;
  target?: ReceivingTarget;
  receipts?: Awaited<ReturnType<typeof getOrderReceipts>>;
}> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const target = await getReceivingTarget(s.org, orderId);
  if (!target) return { ok: false, error: "Pedido não encontrado." };
  const receipts = await getOrderReceipts(s.org, orderId);
  return { ok: true, target, receipts };
}

export async function receiveOrderAction(
  orderId: string,
  lines: ReceiveLine[],
  note: string,
): Promise<R & { status?: string; payable?: number }> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await receiveOrder(
    s.org,
    orderId,
    lines,
    { id: s.sub, name: s.name },
    note,
  );
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/recebimento`);
    revalidatePath(`/espaco/${s.slug}/m/pedidos_compra`);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(
      s,
      "receipt.create",
      `Registrou recebimento de materiais (${res.status})`,
      orderId,
    );
  }
  return res;
}
