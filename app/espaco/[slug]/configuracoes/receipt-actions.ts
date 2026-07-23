"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { saveReceiptConfig, type ReceiptConfig } from "@/lib/endurance/receipt-settings";

export async function saveReceiptConfigAction(
  input: Partial<ReceiptConfig>,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  await saveReceiptConfig(s.org, input);
  await logActivity(s, "settings.receipt", "Ajustou a configuração do recibo");
  revalidatePath(`/espaco/${s.slug}/configuracoes`);
  return { ok: true };
}
