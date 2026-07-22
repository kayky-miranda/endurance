import "server-only";
import { prisma, type Tx } from "@/lib/db";

/**
 * Locais de estoque (matriz, filiais, depósitos, lojas).
 *
 * Invariantes:
 *  - toda organização tem SEMPRE ao menos um local, e exatamente um padrão;
 *  - o saldo por local vive em ProductStock; Product.stock é o TOTAL
 *    consolidado (soma dos locais), mantido pelo razão;
 *  - local com saldo ou histórico não é excluído — é inativado.
 */

export interface LocationRow {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  active: boolean;
  city: string;
  state: string;
  /** Nº de produtos com saldo > 0 e total de unidades no local. */
  skus: number;
  units: number;
}

/**
 * Garante que a organização tenha um local padrão e devolve seu id.
 * Idempotente — usado no onboarding e como fallback do razão.
 */
export async function ensureDefaultLocation(
  org: string,
  db: Tx | typeof prisma = prisma,
): Promise<string> {
  const existing = await db.location.findFirst({
    where: { organizationId: org, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Sem padrão definido: promove o primeiro local, ou cria a Matriz.
  const any = await db.location.findFirst({
    where: { organizationId: org },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (any) {
    await db.location.update({ where: { id: any.id }, data: { isDefault: true } });
    return any.id;
  }
  const created = await db.location.create({
    data: { organizationId: org, name: "Matriz", code: "MTZ", isDefault: true },
    select: { id: true },
  });
  return created.id;
}

/** Local em que o usuário opera (o dele, ou o padrão da organização). */
export async function resolveUserLocation(
  org: string,
  userId?: string | null,
): Promise<string> {
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { locationId: true, organizationId: true },
    });
    if (u?.locationId && u.organizationId === org) {
      const ok = await prisma.location.findFirst({
        where: { id: u.locationId, organizationId: org, active: true },
        select: { id: true },
      });
      if (ok) return ok.id;
    }
  }
  return ensureDefaultLocation(org);
}

export async function listLocations(org: string): Promise<LocationRow[]> {
  const [rows, stocks] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: org },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.productStock.groupBy({
      by: ["locationId"],
      where: { organizationId: org, qty: { gt: 0 } },
      _count: true,
      _sum: { qty: true },
    }),
  ]);
  const byLoc = new Map(
    stocks.map((s) => [s.locationId, { skus: s._count, units: s._sum.qty ?? 0 }]),
  );
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    isDefault: l.isDefault,
    active: l.active,
    city: l.city,
    state: l.state,
    skus: byLoc.get(l.id)?.skus ?? 0,
    units: byLoc.get(l.id)?.units ?? 0,
  }));
}

/** Locais ativos para seletores (PDV, conferência, transferência). */
export async function activeLocations(org: string) {
  await ensureDefaultLocation(org);
  return prisma.location.findMany({
    where: { organizationId: org, active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isDefault: true },
  });
}

export async function createLocation(
  org: string,
  input: { name: string; code?: string; city?: string; state?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const name = input.name.trim().slice(0, 60);
  if (!name) return { ok: false, error: "Informe o nome do local." };

  const dup = await prisma.location.findFirst({
    where: { organizationId: org, name },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "Já existe um local com esse nome." };

  await ensureDefaultLocation(org); // o 1º local da org vira o padrão
  const created = await prisma.location.create({
    data: {
      organizationId: org,
      name,
      code: (input.code ?? "").trim().slice(0, 10),
      city: (input.city ?? "").trim().slice(0, 60),
      state: (input.state ?? "").trim().slice(0, 2).toUpperCase(),
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function updateLocation(
  org: string,
  id: string,
  input: { name?: string; code?: string; city?: string; state?: string },
): Promise<{ ok: boolean; error?: string }> {
  const loc = await prisma.location.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!loc) return { ok: false, error: "Local não encontrado." };

  const name = input.name?.trim().slice(0, 60);
  if (name === "") return { ok: false, error: "Informe o nome do local." };
  if (name) {
    const dup = await prisma.location.findFirst({
      where: { organizationId: org, name, id: { not: id } },
      select: { id: true },
    });
    if (dup) return { ok: false, error: "Já existe um local com esse nome." };
  }

  await prisma.location.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(input.code !== undefined ? { code: input.code.trim().slice(0, 10) } : {}),
      ...(input.city !== undefined ? { city: input.city.trim().slice(0, 60) } : {}),
      ...(input.state !== undefined
        ? { state: input.state.trim().slice(0, 2).toUpperCase() }
        : {}),
    },
  });
  return { ok: true };
}

/** Define o local padrão da organização (exatamente um por org). */
export async function setDefaultLocation(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const loc = await prisma.location.findFirst({
    where: { id, organizationId: org, active: true },
    select: { id: true },
  });
  if (!loc) return { ok: false, error: "Local não encontrado ou inativo." };
  await prisma.$transaction([
    prisma.location.updateMany({
      where: { organizationId: org },
      data: { isDefault: false },
    }),
    prisma.location.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return { ok: true };
}

/**
 * Ativa/inativa um local. Inativar exige saldo zerado (o estoque precisa ser
 * transferido antes) e nunca deixa a organização sem local padrão ativo.
 */
export async function setLocationActive(
  org: string,
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const loc = await prisma.location.findFirst({
    where: { id, organizationId: org },
    select: { id: true, isDefault: true },
  });
  if (!loc) return { ok: false, error: "Local não encontrado." };

  if (!active) {
    if (loc.isDefault)
      return {
        ok: false,
        error: "Este é o local padrão. Defina outro como padrão antes de inativar.",
      };
    const withStock = await prisma.productStock.count({
      where: { locationId: id, qty: { not: 0 } },
    });
    if (withStock > 0)
      return {
        ok: false,
        error: `O local ainda tem saldo em ${withStock} produto(s). Transfira o estoque antes de inativar.`,
      };
  }

  await prisma.location.update({ where: { id }, data: { active } });
  return { ok: true };
}

/** Saldo de um produto em cada local (para a tela de estoque). */
export async function productStockByLocation(org: string, productId: string) {
  return prisma.productStock.findMany({
    where: { organizationId: org, productId },
    select: { qty: true, location: { select: { id: true, name: true, active: true } } },
    orderBy: { location: { name: "asc" } },
  });
}
