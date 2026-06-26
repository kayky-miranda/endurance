"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requirePermissionVerified } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  emitNfce,
  cancelNfce,
  type EmitResult,
} from "@/lib/endurance/fiscal-service";
import { logActivity } from "@/lib/endurance/activity-log";
import { FiscalConfigSchema, firstError } from "@/lib/validation";

export async function emitNfceAction(saleId: string): Promise<EmitResult> {
  // Gate reforçado: emissão fiscal exige e-mail verificado (LGPD + compliance).
  const gate = await requirePermissionVerified("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await emitNfce(s.org, saleId);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/nfce`);
    await logActivity(s, "nfce.emit", `Emitiu NFC-e nº ${res.numero}`, res.docId);
  }
  return res;
}

export async function cancelNfceAction(
  docId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await cancelNfce(s.org, docId, motivo);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/nfce`);
    await logActivity(
      s,
      "nfce.cancel",
      `Cancelou NFC-e${motivo ? ` (motivo: ${motivo.trim().slice(0, 80)})` : ""}`,
      docId,
    );
  }
  return res;
}

export interface FiscalConfigInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  ie: string;
  crt: string;
  uf: string;
  municipio: string;
  cMun: string;
  serie: number;
  ambiente: string;
  cscId: string;
  csc: string;
  provider: string;
  defaultNcm: string;
}

export async function saveFiscalConfigAction(
  input: FiscalConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const parsed = FiscalConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  await prisma.fiscalConfig.upsert({
    where: { organizationId: s.org },
    create: { organizationId: s.org, ...data },
    update: data,
  });
  revalidatePath(`/espaco/${s.slug}/m/nfce`);
  await logActivity(
    s,
    "fiscal.config_save",
    `Atualizou a configuração fiscal (${data.razaoSocial})`,
  );
  return { ok: true };
}
