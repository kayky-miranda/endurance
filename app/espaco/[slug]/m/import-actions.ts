"use server";

import { revalidatePath } from "next/cache";
import { getSession, canManageTeam } from "@/lib/auth";
import {
  validateImport,
  commitImport,
  type ValidateResult,
  type CommitResult,
} from "@/lib/endurance/import-service";

export async function validateImportAction(
  entity: string,
  text: string,
): Promise<ValidateResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role))
    return { ok: false, error: "Acesso restrito a administradores." };
  return validateImport(s.org, entity, text);
}

export async function commitImportAction(
  entity: string,
  text: string,
): Promise<CommitResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };
  if (!canManageTeam(s.role))
    return { ok: false, error: "Acesso restrito a administradores." };
  const res = await commitImport(s.org, entity, text);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/crm`);
    revalidatePath(`/espaco/${s.slug}/m/fornecedores`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
  }
  return res;
}
