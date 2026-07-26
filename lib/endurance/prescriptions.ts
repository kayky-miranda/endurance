import "server-only";
import { prisma } from "@/lib/db";

/**
 * Receituário: receitas do paciente com itens (medicamento + posologia).
 * Documento imprimível. Exclusão LÓGICA preserva o histórico. Isolado por
 * organização; RBAC (prontuario.manage) nas actions.
 */

export interface PrescriptionItem {
  medication: string;
  dosage: string;
  quantity: string;
  notes: string;
  position: number;
}

export interface PrescriptionSummary {
  id: string;
  professional: string;
  cid: string;
  cidDescription: string;
  itemsCount: number;
  issuedAt: string; // ISO
}

export interface PrescriptionFull {
  id: string;
  customerId: string;
  professional: string;
  professionalCouncil: string;
  cid: string;
  cidDescription: string;
  instructions: string;
  issuedAt: string;
  items: PrescriptionItem[];
}

export async function listPrescriptions(
  org: string,
  customerId: string,
): Promise<PrescriptionSummary[]> {
  const rows = await prisma.prescription.findMany({
    where: { organizationId: org, customerId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      professional: true,
      cid: true,
      cidDescription: true,
      issuedAt: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    professional: p.professional,
    cid: p.cid,
    cidDescription: p.cidDescription,
    itemsCount: p._count.items,
    issuedAt: p.issuedAt.toISOString(),
  }));
}

export async function getPrescription(
  org: string,
  id: string,
): Promise<PrescriptionFull | null> {
  const p = await prisma.prescription.findFirst({
    where: { id, organizationId: org },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    customerId: p.customerId,
    professional: p.professional,
    professionalCouncil: p.professionalCouncil,
    cid: p.cid,
    cidDescription: p.cidDescription,
    instructions: p.instructions,
    issuedAt: p.issuedAt.toISOString(),
    items: p.items.map((it) => ({
      medication: it.medication,
      dosage: it.dosage,
      quantity: it.quantity,
      notes: it.notes,
      position: it.position,
    })),
  };
}

export type PrescriptionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface PrescriptionInput {
  customerId: string;
  appointmentId?: string | null;
  professionalId?: string | null;
  professional?: string;
  professionalCouncil?: string;
  cid?: string;
  cidDescription?: string;
  instructions?: string;
  items: { medication: string; dosage?: string; quantity?: string; notes?: string }[];
}

function normalizeItems(raw: PrescriptionInput["items"]) {
  return raw
    .filter((it) => it.medication && it.medication.trim().length > 0)
    .map((it, i) => ({
      medication: it.medication.trim(),
      dosage: (it.dosage ?? "").trim(),
      quantity: (it.quantity ?? "").trim(),
      notes: (it.notes ?? "").trim(),
      position: i,
    }));
}

/** Resolve o profissional (snapshot) a partir do usuário, se informado. */
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

export async function createPrescription(
  org: string,
  actor: { id: string; name: string },
  input: PrescriptionInput,
): Promise<PrescriptionResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um medicamento." };
  const prof = await resolveProfessional(org, input.professionalId, input.professional);
  if ("error" in prof) return { ok: false, error: prof.error };

  const created = await prisma.prescription.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      appointmentId: input.appointmentId ?? null,
      professionalId: prof.id,
      professional: prof.name || actor.name,
      professionalCouncil: (input.professionalCouncil ?? "").trim(),
      cid: (input.cid ?? "").trim(),
      cidDescription: (input.cidDescription ?? "").trim(),
      instructions: (input.instructions ?? "").trim(),
      createdById: actor.id,
      createdByName: actor.name,
      items: { create: items },
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updatePrescription(
  org: string,
  id: string,
  input: Omit<PrescriptionInput, "customerId">,
): Promise<PrescriptionResult> {
  const existing = await prisma.prescription.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Receita não encontrada." };
  const items = normalizeItems(input.items);
  if (items.length === 0)
    return { ok: false, error: "Adicione ao menos um medicamento." };
  const prof = await resolveProfessional(org, input.professionalId, input.professional);
  if ("error" in prof) return { ok: false, error: prof.error };

  await prisma.$transaction([
    prisma.prescriptionItem.deleteMany({ where: { prescriptionId: id } }),
    prisma.prescription.update({
      where: { id },
      data: {
        professionalId: prof.id,
        professional: prof.name,
        professionalCouncil: (input.professionalCouncil ?? "").trim(),
        cid: (input.cid ?? "").trim(),
        cidDescription: (input.cidDescription ?? "").trim(),
        instructions: (input.instructions ?? "").trim(),
        items: { create: items },
      },
    }),
  ]);
  return { ok: true, id };
}

export async function deletePrescription(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.prescription.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Receita não encontrada." };
  await prisma.prescription.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
