"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  validateImport,
  commitImport,
  type ValidateResult,
  type CommitResult,
} from "@/lib/endurance/import-service";
import { logActivity } from "@/lib/endurance/activity-log";

export async function validateImportAction(
  entity: string,
  text: string,
): Promise<ValidateResult> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  return validateImport(gate.session.org, entity, text);
}

export async function commitImportAction(
  entity: string,
  text: string,
): Promise<CommitResult> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await commitImport(s.org, entity, text);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/produtos`);
    revalidatePath(`/espaco/${s.slug}/m/estoque`);
    revalidatePath(`/espaco/${s.slug}/m/crm`);
    revalidatePath(`/espaco/${s.slug}/m/fornecedores`);
    revalidatePath(`/espaco/${s.slug}/m/financeiro`);
    await logActivity(
      s,
      "data.import",
      `Importou ${entity} em massa (${res.imported ?? 0} importados, ${res.skipped ?? 0} ignorados)`,
    );
  }
  return res;
}
