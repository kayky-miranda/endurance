"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requirePermissionVerified } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  emitNfce,
  cancelNfce,
  type EmitResult,
} from "@/lib/endurance/fiscal-service";
import { onboardFiscalCompany } from "@/lib/endurance/fiscal-onboarding";
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

/**
 * Envia o certificado A1 da empresa do cliente ao provedor fiscal e habilita a
 * emissão real para ela (modelo multiempresa).
 *
 * Recebe `FormData` de propósito: é o único jeito de o arquivo chegar sem
 * passar por uma serialização intermediária nossa. O `.pfx` e a senha são lidos
 * aqui, seguem para o provedor e morrem com a requisição — nada é gravado.
 * Ver a nota em `lib/endurance/fiscal-providers/focus-empresas.ts`.
 *
 * `requirePermissionVerified` porque habilitar emissão fiscal tem consequência
 * jurídica: a partir daí saem documentos em nome do CNPJ do cliente.
 */
export async function uploadCertificateAction(
  form: FormData,
): Promise<{ ok: boolean; error?: string; dryRun?: boolean; validoAte?: string }> {
  const gate = await requirePermissionVerified("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const file = form.get("certificado");
  if (!(file instanceof File))
    return { ok: false, error: "Selecione o arquivo do certificado (.pfx)." };

  const str = (k: string) => String(form.get(k) ?? "").trim();

  const res = await onboardFiscalCompany(
    s.org,
    {
      certificado: await file.arrayBuffer(),
      senha: String(form.get("senha") ?? ""),
      endereco: {
        cep: str("cep"),
        logradouro: str("logradouro"),
        numero: str("numero"),
        bairro: str("bairro"),
      },
      email: str("email") || s.email,
    },
    // Enquanto não há contrato de parceria, o fluxo roda validando no provedor
    // sem persistir nada do lado dele.
    { dryRun: process.env.FOCUS_NFE_DRY_RUN === "true" },
  );

  if (!res.ok) return res;

  revalidatePath(`/espaco/${s.slug}/m/nfce`);
  // A trilha registra o ATO, nunca o arquivo nem a senha.
  await logActivity(
    s,
    "fiscal.certificate_upload",
    res.dryRun
      ? "Validou o certificado digital no provedor (modo simulação)"
      : "Enviou o certificado digital e habilitou a emissão fiscal",
  );
  return {
    ok: true,
    dryRun: res.dryRun,
    validoAte: res.certValidoAte ? res.certValidoAte.toISOString() : undefined,
  };
}
