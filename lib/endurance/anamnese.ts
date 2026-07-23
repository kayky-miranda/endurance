import "server-only";
import { prisma } from "@/lib/db";
import { anamneseTemplate } from "./anamnese-templates";

/**
 * Anamnese: questionário inicial do paciente. Uma por paciente por organização.
 * Quando ainda não existe, é semeada com o modelo do nicho (perguntas com
 * respostas vazias) — mas nada é gravado até salvar. Exclusão LÓGICA preserva
 * o registro. Isolamento por org; RBAC (anamnese.manage) nas actions.
 */

export interface AnamneseItem {
  question: string;
  answer: string;
  position: number;
}

export interface AnamneseData {
  exists: boolean;
  id: string | null;
  status: "rascunho" | "concluida";
  items: AnamneseItem[];
  createdByName: string;
  updatedAt: string | null;
}

/** Carrega a anamnese do paciente, ou monta o modelo do nicho se não existir. */
export async function getOrInitAnamnese(
  org: string,
  customerId: string,
): Promise<AnamneseData | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return null;

  const existing = await prisma.anamnese.findFirst({
    where: { organizationId: org, customerId },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (existing) {
    return {
      exists: true,
      id: existing.id,
      status: existing.status === "concluida" ? "concluida" : "rascunho",
      items: existing.items.map((it) => ({
        question: it.question,
        answer: it.answer,
        position: it.position,
      })),
      createdByName: existing.createdByName,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const orgRow = await prisma.organization.findUnique({
    where: { id: org },
    select: { niche: true },
  });
  const template = anamneseTemplate(orgRow?.niche);
  return {
    exists: false,
    id: null,
    status: "rascunho",
    items: template.map((q, i) => ({ question: q, answer: "", position: i })),
    createdByName: "",
    updatedAt: null,
  };
}

export interface AnamnesePatientRow {
  id: string;
  name: string;
  status: "rascunho" | "concluida";
  updatedAt: string;
}

/** Pacientes que já têm anamnese, com status. */
export async function listAnamnesePatients(
  org: string,
): Promise<AnamnesePatientRow[]> {
  const rows = await prisma.anamnese.findMany({
    where: { organizationId: org },
    orderBy: { updatedAt: "desc" },
    select: { customerId: true, status: true, updatedAt: true },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.customerId);
  const customers = await prisma.customer.findMany({
    where: { organizationId: org, id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  return rows
    .filter((r) => nameById.has(r.customerId))
    .map((r) => ({
      id: r.customerId,
      name: nameById.get(r.customerId) as string,
      status: r.status === "concluida" ? "concluida" : "rascunho",
      updatedAt: r.updatedAt.toISOString(),
    }));
}

export type AnamneseResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface SaveInput {
  customerId: string;
  status?: "rascunho" | "concluida";
  items: { question: string; answer?: string }[];
}

/** Mantém linhas com pergunta OU resposta preenchida; reindexa position. */
function normalize(
  items: SaveInput["items"],
): { question: string; answer: string; position: number }[] {
  return items
    .map((it) => ({
      question: (it.question ?? "").trim(),
      answer: (it.answer ?? "").trim(),
    }))
    .filter((it) => it.question.length > 0 || it.answer.length > 0)
    .map((it, i) => ({ ...it, position: i }));
}

/** Cria ou atualiza (uma por paciente) — substitui os itens por completo. */
export async function saveAnamnese(
  org: string,
  actor: { id: string; name: string },
  input: SaveInput,
): Promise<AnamneseResult> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  const items = normalize(input.items);
  if (items.length === 0)
    return { ok: false, error: "Preencha ao menos uma pergunta." };
  const status = input.status === "concluida" ? "concluida" : "rascunho";

  const existing = await prisma.anamnese.findFirst({
    where: { organizationId: org, customerId: input.customerId },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.anamneseItem.deleteMany({ where: { anamneseId: existing.id } }),
      prisma.anamnese.update({
        where: { id: existing.id },
        data: { status, items: { create: items } },
      }),
    ]);
    return { ok: true, id: existing.id };
  }

  // Sem registro ATIVO, mas pode haver um excluído logicamente — o
  // @@unique(org, customer) impede recriar. Revive o antigo em vez de criar
  // (o `deletedAt` explícito no where escapa do filtro global de lib/db.ts).
  const soft = await prisma.anamnese.findFirst({
    where: { organizationId: org, customerId: input.customerId, deletedAt: { not: null } },
    select: { id: true },
  });
  if (soft) {
    await prisma.$transaction([
      prisma.anamneseItem.deleteMany({ where: { anamneseId: soft.id } }),
      prisma.anamnese.update({
        where: { id: soft.id },
        data: { status, deletedAt: null, items: { create: items } },
      }),
    ]);
    return { ok: true, id: soft.id };
  }

  const created = await prisma.anamnese.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      status,
      createdById: actor.id,
      createdByName: actor.name,
      items: { create: items },
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/** Exclusão LÓGICA — preserva o registro clínico. */
export async function deleteAnamnese(
  org: string,
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.anamnese.findFirst({
    where: { organizationId: org, customerId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Anamnese não encontrada." };
  await prisma.anamnese.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
