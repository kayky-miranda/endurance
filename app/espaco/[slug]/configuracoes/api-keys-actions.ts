"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createApiKey, revokeApiKey } from "@/lib/endurance/api-keys";
import { logActivity } from "@/lib/endurance/activity-log";

export async function createApiKeyAction(
  name: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return { ok: false, error: gate.error };
  const s = gate.session;

  const { token, prefix } = await createApiKey(s.org, name, {
    id: s.sub,
    name: s.name,
  });
  await logActivity(s, "apikey.create", `Criou a chave de API "${name}" (${prefix}…)`);
  revalidatePath(`/espaco/${s.slug}/configuracoes`);
  // O token completo só existe nesta resposta — nunca é gravado em claro.
  return { ok: true, token };
}

export async function revokeApiKeyAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("integrations.config");
  if (!gate.ok) return gate;
  const s = gate.session;

  const done = await revokeApiKey(s.org, id);
  if (!done) return { ok: false, error: "Chave não encontrada ou já revogada." };
  await logActivity(s, "apikey.revoke", "Revogou uma chave de API", id);
  revalidatePath(`/espaco/${s.slug}/configuracoes`);
  return { ok: true };
}
