"use server";

import { requirePermission } from "@/lib/auth";
import {
  createPixCharge,
  getPixChargeStatus,
  confirmSimulatedPix,
  cancelPixCharge,
  type PixChargeResult,
} from "@/lib/endurance/pix-service";

/**
 * Server actions da cobrança PIX no PDV. Gate em `pdv.sell` — quem opera o caixa
 * gera/consulta cobranças. A criação é idempotente por `token` (token da venda),
 * então reenvio não duplica cobrança.
 */

type Fail = { ok: false; error: string };

export async function createPixChargeAction(input: {
  token: string;
  amount: number;
  customerId?: string | null;
  terminal?: boolean;
}): Promise<PixChargeResult> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate as Fail;
  return createPixCharge(gate.session.org, {
    token: input.token,
    amount: input.amount,
    customerId: input.customerId ?? null,
    terminal: Boolean(input.terminal),
  });
}

export async function getPixChargeStatusAction(
  chargeId: string,
): Promise<PixChargeResult> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate as Fail;
  return getPixChargeStatus(gate.session.org, chargeId);
}

/** Confirma o pagamento no modo SIMULADO (sem PSP para confirmar de verdade). */
export async function confirmSimulatedPixAction(
  chargeId: string,
): Promise<PixChargeResult> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return gate as Fail;
  return confirmSimulatedPix(gate.session.org, chargeId);
}

export async function cancelPixChargeAction(
  chargeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("pdv.sell");
  if (!gate.ok) return { ok: false, error: gate.error };
  return cancelPixCharge(gate.session.org, chargeId);
}
