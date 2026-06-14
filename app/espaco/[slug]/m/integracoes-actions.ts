"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  savePixConfig,
  listPixDevices,
  type SavePixConfigInput,
} from "@/lib/endurance/pix-service";
import type { PixDevice } from "@/lib/endurance/pix-provider";
import {
  saveWhatsAppConfig,
  type SaveWhatsAppConfigInput,
} from "@/lib/endurance/whatsapp-service";

/**
 * Configuração das integrações PIX e WhatsApp. Gate em `integrations.config`.
 * Apenas dados NÃO-secretos (chave PIX, phoneNumberId) — os tokens dos provedores
 * ficam em variáveis de ambiente no servidor.
 */

type R = { ok: boolean; error?: string };

export async function savePixConfigAction(input: SavePixConfigInput): Promise<R> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return gate;
  const res = await savePixConfig(gate.session.org, input);
  if (res.ok) revalidatePath(`/espaco/${gate.session.slug}/m/notificacoes`);
  return res;
}

/** Lista as maquininhas pareadas no PSP (Mercado Pago Point) para configurar. */
export async function listPixDevicesAction(): Promise<
  { ok: true; devices: PixDevice[] } | { ok: false; error: string }
> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return { ok: false, error: gate.error };
  return listPixDevices(gate.session.org);
}

export async function saveWhatsAppConfigAction(
  input: SaveWhatsAppConfigInput,
): Promise<R> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return gate;
  const res = await saveWhatsAppConfig(gate.session.org, input);
  if (res.ok) revalidatePath(`/espaco/${gate.session.slug}/m/notificacoes`);
  return res;
}
