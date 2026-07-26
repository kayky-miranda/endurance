import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { rangesOverlap } from "./scheduling";
import { isValidBlockKind, blockKindLabel } from "./schedule-block";

/**
 * Bloqueios de agenda: intervalos indisponíveis para agendamento. Um bloqueio
 * sem profissional vale para a agenda TODA (feriado); com profissional, só para
 * ele. A detecção de conflito da Agenda consulta estes bloqueios.
 */

export interface BlockRow {
  id: string;
  professionalId: string | null;
  professional: string;
  kind: string;
  kindLabel: string;
  reason: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
}

function toRow(b: {
  id: string;
  professionalId: string | null;
  professional: string;
  kind: string;
  reason: string;
  startsAt: Date;
  endsAt: Date;
}): BlockRow {
  return {
    id: b.id,
    professionalId: b.professionalId,
    professional: b.professional,
    kind: b.kind,
    kindLabel: blockKindLabel(b.kind),
    reason: b.reason,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
  };
}

/** Bloqueios que tocam o intervalo [from, to) — para render no calendário. */
export async function listBlocksRange(
  org: string,
  from: Date,
  to: Date,
  opts: { professionalId?: string } = {},
): Promise<BlockRow[]> {
  const rows = await prisma.scheduleBlock.findMany({
    where: {
      organizationId: org,
      startsAt: { lt: to },
      endsAt: { gt: from },
      ...(opts.professionalId
        ? { OR: [{ professionalId: opts.professionalId }, { professionalId: null }] }
        : {}),
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toRow);
}

/**
 * Verifica se um atendimento [startsAt, startsAt+durationMin) cai sobre um
 * bloqueio. Considera bloqueios GLOBAIS (professionalId null) sempre, e os do
 * profissional do atendimento. Retorna o bloqueio conflitante ou null.
 */
export async function findBlockConflict(
  org: string,
  professionalId: string | null | undefined,
  startsAt: Date,
  durationMin: number,
  db: Tx | typeof prisma = prisma,
): Promise<BlockRow | null> {
  const startMs = startsAt.getTime();
  const endMs = startMs + durationMin * 60_000;

  const candidates = await db.scheduleBlock.findMany({
    where: {
      organizationId: org,
      startsAt: { lt: new Date(endMs) },
      endsAt: { gt: startsAt },
      OR: [
        { professionalId: null },
        ...(professionalId ? [{ professionalId }] : []),
      ],
    },
  });
  for (const b of candidates) {
    if (rangesOverlap(startMs, endMs, b.startsAt.getTime(), b.endsAt.getTime())) {
      return toRow(b);
    }
  }
  return null;
}

export type BlockResult = { ok: true; id: string } | { ok: false; error: string };

export interface BlockInput {
  professionalId?: string | null;
  professional?: string;
  kind?: string;
  reason?: string;
  startsAt: Date;
  endsAt: Date;
}

export async function createBlock(
  org: string,
  actor: { id: string; name: string },
  input: BlockInput,
): Promise<BlockResult> {
  if (!(input.startsAt instanceof Date) || isNaN(input.startsAt.getTime()))
    return { ok: false, error: "Início inválido." };
  if (!(input.endsAt instanceof Date) || isNaN(input.endsAt.getTime()))
    return { ok: false, error: "Fim inválido." };
  if (input.endsAt.getTime() <= input.startsAt.getTime())
    return { ok: false, error: "O fim deve ser depois do início." };

  const kind = isValidBlockKind(input.kind ?? "") ? input.kind! : "bloqueio";

  // Resolve o nome do profissional (snapshot) se informado.
  let professionalId: string | null = null;
  let professional = "";
  if (input.professionalId) {
    const u = await prisma.user.findFirst({
      where: { id: input.professionalId, organizationId: org },
      select: { id: true, name: true },
    });
    if (!u) return { ok: false, error: "Profissional não encontrado." };
    professionalId = u.id;
    professional = u.name;
  }

  const created = await prisma.scheduleBlock.create({
    data: {
      organizationId: org,
      professionalId,
      professional,
      kind,
      reason: (input.reason ?? "").trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function deleteBlock(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.scheduleBlock.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Bloqueio não encontrado." };
  await prisma.scheduleBlock.delete({ where: { id } });
  return { ok: true };
}
