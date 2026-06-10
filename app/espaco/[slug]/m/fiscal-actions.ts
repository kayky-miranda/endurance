"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  emitNfce,
  cancelNfce,
  type EmitResult,
} from "@/lib/endurance/fiscal-service";

export async function emitNfceAction(saleId: string): Promise<EmitResult> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await emitNfce(s.org, saleId);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfce`);
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
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/nfce`);
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
}

export async function saveFiscalConfigAction(
  input: FiscalConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const data = {
    cnpj: (input.cnpj ?? "").replace(/\D/g, "").slice(0, 14),
    razaoSocial: (input.razaoSocial ?? "").trim().slice(0, 120),
    nomeFantasia: (input.nomeFantasia ?? "").trim().slice(0, 120),
    ie: (input.ie ?? "").trim().slice(0, 20),
    crt: input.crt === "3" ? "3" : "1",
    uf: (input.uf ?? "SP").toUpperCase().slice(0, 2),
    municipio: (input.municipio ?? "").trim().slice(0, 80),
    cMun: (input.cMun ?? "").replace(/\D/g, "").slice(0, 7),
    serie: Math.max(1, Math.min(999, Math.trunc(Number(input.serie) || 1))),
    ambiente: input.ambiente === "1" ? "1" : "2",
    cscId: (input.cscId ?? "000001").replace(/\D/g, "").slice(0, 6) || "000001",
    csc: (input.csc ?? "").trim().slice(0, 64),
  };
  if (!data.cnpj || data.cnpj.length !== 14)
    return { ok: false, error: "Informe um CNPJ válido (14 dígitos)." };
  if (!data.razaoSocial)
    return { ok: false, error: "Informe a razão social." };

  await prisma.fiscalConfig.upsert({
    where: { organizationId: s.org },
    create: { organizationId: s.org, ...data },
    update: data,
  });
  revalidatePath(`/espaco/${s.slug}/m/nfce`);
  return { ok: true };
}
