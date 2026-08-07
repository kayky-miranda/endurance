import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  MODULES,
  NICHES,
  type NicheId,
  activeModuleIds,
  coreModules,
  modulesForNiche,
  nicheLabel,
} from "./catalog";
import { TRIAL_DAYS, TRIAL_PLAN, planById } from "./billing";

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

  // Duração do teste: tempo suficiente para o cliente rodar um ciclo real de
  // trabalho (uma semana de agenda cheia, um fechamento) antes de decidir.
  // A constante vive no catálogo — é a mesma que o card do teste anuncia.
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

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
      // Toda organização nasce com um local padrão — é nele que o estoque
      // reside até que filiais/depósitos sejam criados.
      locations: {
        create: { name: "Matriz", code: "MTZ", isDefault: true },
      },
      users: {
        create: {
          email,
          passwordHash: input.owner.passwordHash,
          name: input.owner.name.trim() || name,
          role: "OWNER",
        },
      },
      // TESTE de 14 dias com o Professional COMPLETO, criado junto com a
      // organização (mesma transação) — assim nenhuma empresa existe sem
      // assinatura, o que antes tornava ambíguo distinguir cliente antigo de
      // empresa nova no controle de capacidades.
      //
      // O teste entrega o plano inteiro de propósito: o cliente precisa ver o
      // produto funcionando com os dados dele para decidir. Um teste capado
      // demonstra a versão limitada, não o produto.
      subscription: {
        create: {
          plan: TRIAL_PLAN,
          status: "trialing",
          seats: planById(TRIAL_PLAN)?.seats ?? 3,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
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
 *
 * PROVISIONAMENTO AUTO-CURÁVEL: a lista de módulos NÃO sai só das linhas de
 * OrgModule. Um módulo do catálogo que é core ou pertence ao ramo da empresa e
 * que NUNCA foi configurado (não tem linha nenhuma) conta como disponível.
 *
 * A distinção é o ponto central: **ausência de linha ≠ desligado**.
 *  - linha `enabled: true`  → ligado;
 *  - linha `enabled: false` → o usuário desligou de propósito (respeitamos);
 *  - sem linha              → o catálogo cresceu depois que o espaço nasceu.
 *
 * Sem isso, todo módulo novo ficava invisível para as empresas já existentes
 * (sidebar sem o item e a rota caindo em 404 no `loadModule`) até alguém rodar
 * um script de backfill à mão — exatamente o que aconteceu com o Cadastro de
 * pacientes.
 */
export const getWorkspace = cache(async function getWorkspace(
  slug: string,
): Promise<WorkspaceView | null> {
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { modules: true },
  });
  if (!org) return null;

  const activeIds = activeModuleIds(
    org.niche,
    new Map(org.modules.map((om) => [om.moduleId, om.enabled])),
  );

  // Percorre o CATÁLOGO (e não as linhas) para a ordem ficar estável.
  const modules = MODULES.filter((def) => activeIds.has(def.id)).map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    core: def.scope === "core",
  }));

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
