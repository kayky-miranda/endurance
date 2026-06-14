import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  NICHES,
  type NicheId,
  coreModules,
  moduleById,
  modulesForNiche,
  nicheLabel,
} from "./catalog";

export interface CreateWorkspaceInput {
  name?: string;
  niche: string;
  city?: string;
  state?: string;
  country?: string;
  segment?: string;
  moduleIds: string[];
  /** Dono do espaço — criado como primeiro usuário (role OWNER). */
  owner: { name: string; email: string; passwordHash: string };
}

/** Lançado quando o e-mail do dono já está cadastrado. */
export class EmailTakenError extends Error {
  constructor() {
    super("E-mail já cadastrado.");
    this.name = "EmailTakenError";
  }
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

/**
 * Cria um espaço (Organization) + os módulos ativados (OrgModule), persistidos.
 * Revalida nicho e módulos contra o catálogo no servidor — nunca confia só no
 * cliente. Devolve o slug para navegar até o espaço criado.
 */
export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<{ slug: string; userId: string; orgId: string }> {
  const email = input.owner.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new EmailTakenError();

  const validNiche = NICHES.some((n) => n.id === input.niche);
  const niche: NicheId | "outro" = validNiche
    ? (input.niche as NicheId)
    : "outro";

  // Só persiste módulos que existem e fazem sentido (core + nicho).
  const allowed = new Set<string>([
    ...coreModules().map((m) => m.id),
    ...(niche !== "outro" ? modulesForNiche(niche).map((m) => m.id) : []),
  ]);
  const moduleIds = Array.from(
    new Set((input.moduleIds ?? []).filter((id) => allowed.has(id))),
  );
  if (moduleIds.length === 0) {
    // Garante ao menos o núcleo.
    for (const m of coreModules()) moduleIds.push(m.id);
  }

  const name =
    (input.name ?? "").trim() ||
    (input.segment ?? "").trim() ||
    `${nicheLabel(niche)}${input.city ? ` · ${input.city}` : ""}`;

  // Slug único: base + sufixo aleatório se já existir.
  const base = slugify(name) || "espaco";
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${base}-${randomSuffix()}`;
  }

  const org = await prisma.organization.create({
    data: {
      slug,
      name,
      niche,
      nicheLabel: nicheLabel(niche),
      city: (input.city ?? "").trim(),
      state: (input.state ?? "").trim(),
      country: (input.country ?? "").trim(),
      segment: (input.segment ?? "").trim(),
      modules: {
        create: moduleIds.map((moduleId) => ({ moduleId, enabled: true })),
      },
      users: {
        create: {
          email,
          passwordHash: input.owner.passwordHash,
          name: input.owner.name.trim() || name,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });

  return { slug, orgId: org.id, userId: org.users[0].id };
}

export interface WorkspaceView {
  slug: string;
  name: string;
  niche: string;
  nicheLabel: string;
  city: string;
  state: string;
  country: string;
  segment: string;
  createdAt: string;
  modules: { id: string; label: string; description: string; core: boolean }[];
}

/**
 * Carrega um espaço pelo slug, já mapeando os ids para rótulos do catálogo.
 * Deduplicado por request com React cache() — layout e página do módulo
 * compartilham a mesma consulta no mesmo render.
 */
export const getWorkspace = cache(async function getWorkspace(
  slug: string,
): Promise<WorkspaceView | null> {
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { modules: true },
  });
  if (!org) return null;

  const modules = org.modules
    .map((om) => {
      const def = moduleById(om.moduleId);
      if (!def) return null;
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        core: def.scope === "core",
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return {
    slug: org.slug,
    name: org.name,
    niche: org.niche,
    nicheLabel: org.nicheLabel,
    city: org.city,
    state: org.state,
    country: org.country,
    segment: org.segment,
    createdAt: org.createdAt.toISOString(),
    modules,
  };
});
