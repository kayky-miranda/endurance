"use server";

import { revalidatePath } from "next/cache";
import { getSession, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  saveDocumentSettings,
  saveSignature,
  type DocumentSettingsInput,
} from "@/lib/endurance/document-letterhead";

/**
 * Ações do papel timbrado.
 *
 * O TIMBRE é da clínica → exige `settings.general`. A ASSINATURA é pessoal:
 * cada profissional cadastra a sua, então basta a sessão — exigir permissão de
 * administrador obrigaria o dono a subir a assinatura alheia, o que não faz
 * sentido para um documento com responsabilidade técnica individual.
 */

export type DocumentSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveDocumentSettingsAction(
  input: DocumentSettingsInput,
): Promise<DocumentSettingsResult> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;

  const res = await saveDocumentSettings(s.org, input);
  if (!res.ok) return { ok: false, error: res.error ?? "Não foi possível salvar." };
  await logActivity(s, "documents.settings", "Atualizou o papel timbrado dos documentos");
  revalidatePath(`/espaco/${s.slug}/configuracoes`);
  return { ok: true };
}

export async function saveSignatureAction(
  signatureDataUrl: string | null,
): Promise<DocumentSettingsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };

  const res = await saveSignature(session.org, session.sub, signatureDataUrl);
  if (!res.ok) return { ok: false, error: res.error ?? "Não foi possível salvar." };
  await logActivity(
    session,
    "documents.signature",
    signatureDataUrl ? "Atualizou a própria assinatura" : "Removeu a própria assinatura",
  );
  revalidatePath(`/espaco/${session.slug}/configuracoes`);
  return { ok: true };
}
