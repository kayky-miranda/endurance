import "server-only";
import { prisma } from "@/lib/db";
import { isValidCertificateKind, certificateKindLabel } from "./certificate";
// Reexporta as constantes puras para os consumidores de servidor (a página de
// impressão etc.). Client Components devem importar direto de "./certificate".
export { CERTIFICATE_KINDS, isValidCertificateKind, certificateKindLabel } from "./certificate";

/**
 * Atestados médicos: documento imprimível (comparecimento, afastamento, outro).
 * Exclusão LÓGICA preserva o histórico. Isolado por organização; RBAC
 * (prontuario.manage) nas actions. As CONSTANTES puras (tipos/rótulos) vivem em
 * ./certificate para poderem ser importadas por Client Components.
 */

export interface CertificateSummary {
  id: string;
  kind: string;
  kindLabel: string;
  professional: string;
  days: number | null;
  cid: string;
  issuedAt: string;
}

export interface CertificateFull {
  id: string;
  customerId: string;
  kind: string;
  professional: string;
  professionalCouncil: string;
  cid: string;
  cidDescription: string;
  days: number | null;
  startDate: string | null;
  text: string;
  issuedAt: string;
}

export async function listCertificates(
  org: string,
  customerId: string,
): Promise<CertificateSummary[]> {
  const rows = await prisma.certificate.findMany({
    where: { organizationId: org, customerId },
    orderBy: { issuedAt: "desc" },
    select: { id: true, kind: true, professional: true, days: true, cid: true, issuedAt: true },
  });
  return rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    kindLabel: certificateKindLabel(c.kind),
    professional: c.professional,
    days: c.days,
    cid: c.cid,
    issuedAt: c.issuedAt.toISOString(),
  }));
}

export async function getCertificate(
  org: string,
  id: string,
): Promise<CertificateFull | null> {
  const c = await prisma.certificate.findFirst({ where: { id, organizationId: org } });
  if (!c) return null;
  return {
    id: c.id,
    customerId: c.customerId,
    kind: c.kind,
    professional: c.professional,
    professionalCouncil: c.professionalCouncil,
    cid: c.cid,
    cidDescription: c.cidDescription,
    days: c.days,
    startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
    text: c.text,
    issuedAt: c.issuedAt.toISOString(),
  };
}

export type CertificateResult = { ok: true; id: string } | { ok: false; error: string };

interface CertificateInput {
  customerId: string;
  professionalId?: string | null;
  professional?: string;
  professionalCouncil?: string;
  kind?: string;
  cid?: string;
  cidDescription?: string;
  days?: number | null;
  startDate?: string | null;
  text?: string;
}

async function resolveProfessional(
  org: string,
  professionalId: string | null | undefined,
  fallbackName: string | undefined,
): Promise<{ id: string | null; name: string } | { error: string }> {
  if (professionalId) {
    const u = await prisma.user.findFirst({
      where: { id: professionalId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!u) return { error: "Profissional não encontrado." };
    return { id: u.id, name: u.name };
  }
  return { id: null, name: (fallbackName ?? "").trim() };
}

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

function buildData(input: CertificateInput, prof: { id: string | null; name: string }, actor: { id: string; name: string }) {
  const kind = isValidCertificateKind(input.kind ?? "") ? input.kind! : "afastamento";
  const days = input.days == null || isNaN(Number(input.days)) ? null : Math.max(0, Math.floor(Number(input.days)));
  return {
    professionalId: prof.id,
    professional: prof.name || actor.name,
    professionalCouncil: (input.professionalCouncil ?? "").trim(),
    kind,
    cid: (input.cid ?? "").trim(),
    cidDescription: (input.cidDescription ?? "").trim(),
    days: kind === "afastamento" ? days : null,
    startDate: kind === "afastamento" ? parseDate(input.startDate) : null,
    text: (input.text ?? "").trim(),
  };
}

export async function createCertificate(
  org: string,
  actor: { id: string; name: string },
  input: CertificateInput,
): Promise<CertificateResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };
  const prof = await resolveProfessional(org, input.professionalId, input.professional);
  if ("error" in prof) return { ok: false, error: prof.error };

  const created = await prisma.certificate.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      createdById: actor.id,
      createdByName: actor.name,
      ...buildData(input, prof, actor),
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateCertificate(
  org: string,
  id: string,
  input: Omit<CertificateInput, "customerId">,
  actor: { id: string; name: string },
): Promise<CertificateResult> {
  const existing = await prisma.certificate.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Atestado não encontrado." };
  const prof = await resolveProfessional(org, input.professionalId, input.professional);
  if ("error" in prof) return { ok: false, error: prof.error };

  await prisma.certificate.update({
    where: { id },
    data: buildData({ ...input, customerId: "" }, prof, actor),
  });
  return { ok: true, id };
}

export async function deleteCertificate(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.certificate.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Atestado não encontrado." };
  await prisma.certificate.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
