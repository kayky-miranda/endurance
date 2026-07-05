"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { recordManualMovement } from "@/lib/endurance/stock-ledger";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

export async function recordManualMovementAction(input: {
  productId: string;
  reason: string;
  quantity: number;
  note?: string;
}): Promise<R> {
  const gate = await requirePermission("stock.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await recordManualMovement(s.org, {
    productId: input.productId,
    reason: input.reason,
    quantity: input.quantity,
    note: input.note,
    actor: { id: s.sub, name: s.name },
  });
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/movimentacoes`);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    await logActivity(
      s,
      "stock.movement",
      `Movimentação manual de estoque (${input.reason}, ${input.quantity})`,
      input.productId,
    );
  }
  return res;
}
