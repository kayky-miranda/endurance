"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/endurance/document-templates";

/** Ações dos modelos de documento. Gate `prontuario.manage`. */

export type TemplateActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidate(slug: string) {
  revalidatePath(`/espaco/${slug}/m/prontuario`);
}

export async function saveTemplateAction(payload: {
  id?: string;
  type?: string;
  title: string;
  content: string;
}): Promise<TemplateActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = payload.id
    ? await updateTemplate(s.org, payload.id, payload)
    : await createTemplate(s.org, { id: s.sub, name: s.name }, payload);
  if (!res.ok) return res;
  await logActivity(
    s,
    payload.id ? "template.update" : "template.create",
    `${payload.id ? "Editou" : "Criou"} o modelo "${payload.title}"`,
    res.id,
  );
  revalidate(s.slug);
  return { ok: true, id: res.id };
}

export async function deleteTemplateAction(id: string): Promise<TemplateActionResult> {
  const gate = await requirePermission("prontuario.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteTemplate(s.org, id);
  if (!res.ok) return { ok: false, error: res.error ?? "Falha." };
  await logActivity(s, "template.delete", "Removeu um modelo de documento", id);
  revalidate(s.slug);
  return { ok: true };
}
