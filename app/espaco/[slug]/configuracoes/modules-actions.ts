"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { setModuleEnabled, setOrgNiche } from "@/lib/endurance/modules-admin";
import { moduleById, nicheLabel } from "@/lib/endurance/catalog";
import type { NicheId } from "@/lib/endurance/catalog";

type R = { ok: boolean; error?: string };

function revalidate(slug: string) {
  // A troca de módulos muda a navegação inteira (sidebar) e o gate de acesso.
  revalidatePath(`/espaco/${slug}`, "layout");
  revalidatePath(`/espaco/${slug}/configuracoes`);
}

export async function setModuleEnabledAction(
  moduleId: string,
  enabled: boolean,
): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setModuleEnabled(s.org, moduleId, enabled);
  if (!res.ok) return res;
  await logActivity(
    s,
    enabled ? "module.enable" : "module.disable",
    `${enabled ? "Ativou" : "Desativou"} o módulo ${moduleById(moduleId)?.label ?? moduleId}`,
    moduleId,
  );
  revalidate(s.slug);
  return { ok: true };
}

export async function setOrgNicheAction(niche: string): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setOrgNiche(s.org, niche);
  if (!res.ok) return res;
  await logActivity(
    s,
    "org.niche",
    `Definiu o ramo de atuação: ${nicheLabel(niche as NicheId)}`,
  );
  revalidate(s.slug);
  return { ok: true };
}
