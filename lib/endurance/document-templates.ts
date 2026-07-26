import "server-only";
import { prisma } from "@/lib/db";
import { isValidTemplateType, templateTypeLabel } from "./doc-template";

/**
 * Modelos prontos de documento/texto clínico (por organização). Exclusão
 * LÓGICA. Isolado por org; RBAC (prontuario.manage) nas actions.
 */

export interface TemplateRow {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  content: string;
}

function toRow(t: { id: string; type: string; title: string; content: string }): TemplateRow {
  return {
    id: t.id,
    type: t.type,
    typeLabel: templateTypeLabel(t.type),
    title: t.title,
    content: t.content,
  };
}

/** Modelos da org, opcionalmente filtrados por tipo. */
export async function listTemplates(
  org: string,
  opts: { type?: string } = {},
): Promise<TemplateRow[]> {
  const rows = await prisma.documentTemplate.findMany({
    where: {
      organizationId: org,
      ...(opts.type && isValidTemplateType(opts.type) ? { type: opts.type } : {}),
    },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });
  return rows.map(toRow);
}

export type TemplateResult = { ok: true; id: string } | { ok: false; error: string };

interface TemplateInput {
  type?: string;
  title: string;
  content: string;
}

function validate(input: TemplateInput): string | null {
  if (!input.title || !input.title.trim()) return "Dê um título ao modelo.";
  if (!input.content || !input.content.trim()) return "O modelo não pode ficar vazio.";
  return null;
}

export async function createTemplate(
  org: string,
  actor: { id: string; name: string },
  input: TemplateInput,
): Promise<TemplateResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  const type = isValidTemplateType(input.type ?? "") ? input.type! : "nota";
  const created = await prisma.documentTemplate.create({
    data: {
      organizationId: org,
      type,
      title: input.title.trim(),
      content: input.content.trim(),
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateTemplate(
  org: string,
  id: string,
  input: TemplateInput,
): Promise<TemplateResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  const existing = await prisma.documentTemplate.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Modelo não encontrado." };
  const type = isValidTemplateType(input.type ?? "") ? input.type! : "nota";
  await prisma.documentTemplate.update({
    where: { id },
    data: { type, title: input.title.trim(), content: input.content.trim() },
  });
  return { ok: true, id };
}

export async function deleteTemplate(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.documentTemplate.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Modelo não encontrado." };
  await prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
