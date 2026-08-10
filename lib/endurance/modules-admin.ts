import "server-only";
import { prisma } from "@/lib/db";
import {
  MODULES,
  NICHES,
  isNicheAvailable,
  MODULE_CATEGORIES,
  activeModuleIds,
  moduleCategory,
  moduleById,
  modulesForNiche,
  coreModules,
  nicheLabel,
  type ModuleCategory,
  type NicheId,
} from "./catalog";

/**
 * Administração da arquitetura modular por organização: qual ramo de atuação
 * (nicho) a empresa segue e quais módulos estão ligados. É o que permite a
 * plataforma se adaptar ao segmento SEM sobrecarregar a interface — o lojista
 * escolhe o ramo e o sistema liga os módulos certos; ele pode afinar depois.
 *
 * Regras:
 *  - módulos "core" estão sempre ligados e não podem ser desligados;
 *  - um módulo só pode ser ligado se for core OU pertencer a ALGUM nicho
 *    (não deixamos ligar um módulo que não existe para nenhum segmento);
 *  - trocar o ramo LIGA os módulos daquele ramo, sem desligar o que já havia
 *    (a troca é aditiva — quem quiser enxuga desligando manualmente).
 */

export interface ModuleToggle {
  id: string;
  label: string;
  description: string;
  category: ModuleCategory;
  core: boolean;
  enabled: boolean;
  /** Nichos a que o módulo pertence (vazio para core). */
  niches: string[];
  /** É recomendado para o ramo atual da empresa. */
  recommended: boolean;
}

export interface ModulesConfig {
  niche: string;
  nicheLabel: string;
  niches: { id: NicheId; label: string }[];
  categories: { category: ModuleCategory; modules: ModuleToggle[] }[];
}

const VALID_NICHES = new Set<string>(NICHES.map((n) => n.id));
const CORE_IDS = new Set(coreModules().map((m) => m.id));

/** Todos os ids que podem ser ligados: core + qualquer módulo de nicho. */
function assignableIds(): Set<string> {
  return new Set(
    MODULES.filter((m) => m.scope === "core" || Array.isArray(m.scope)).map(
      (m) => m.id,
    ),
  );
}

export async function getModulesConfig(org: string): Promise<ModulesConfig> {
  const [orgRow, rows] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org },
      select: { niche: true, nicheLabel: true },
    }),
    prisma.orgModule.findMany({ where: { organizationId: org } }),
  ]);
  const niche = orgRow?.niche ?? "";
  // Mesma fonte da verdade da navegação: sem linha = padrão do catálogo, não
  // "desligado" (senão a tela de Configurações discordaria da sidebar).
  const enabledSet = activeModuleIds(
    niche,
    new Map(rows.map((r) => [r.moduleId, r.enabled])),
  );
  const recommended = new Set(
    VALID_NICHES.has(niche) ? modulesForNiche(niche as NicheId).map((m) => m.id) : [],
  );

  const toggles: ModuleToggle[] = MODULES.map((m) => {
    const core = m.scope === "core";
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      category: moduleCategory(m.id),
      core,
      enabled: core || enabledSet.has(m.id),
      niches: Array.isArray(m.scope) ? m.scope : [],
      recommended: core || recommended.has(m.id),
    };
  });

  const categories = MODULE_CATEGORIES.map((category) => ({
    category,
    modules: toggles.filter((t) => t.category === category),
  })).filter((c) => c.modules.length > 0);

  return {
    niche,
    nicheLabel: orgRow?.nicheLabel ?? nicheLabel((niche || "outro") as NicheId),
    // Oferece os ramos disponíveis MAIS o atual, quando ele já não é
    // oferecido: sem isso, a empresa que escolheu Academia veria o próprio
    // ramo sumir do seletor e não conseguiria nem reconhecer a configuração
    // dela. Ela continua onde está; só não há caminho de volta depois de sair.
    niches: NICHES.filter(
      (n) => n.available !== false || n.id === niche,
    ).map((n) => ({ id: n.id, label: n.label })),
    categories,
  };
}

/** Liga/desliga um módulo. Core nunca desliga; só liga o que é atribuível. */
export async function setModuleEnabled(
  org: string,
  moduleId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const def = moduleById(moduleId);
  if (!def) return { ok: false, error: "Módulo desconhecido." };
  if (CORE_IDS.has(moduleId) && !enabled)
    return { ok: false, error: "Módulos essenciais não podem ser desligados." };
  if (enabled && !assignableIds().has(moduleId))
    return { ok: false, error: "Este módulo não está disponível para ativação." };

  await prisma.orgModule.upsert({
    where: { organizationId_moduleId: { organizationId: org, moduleId } },
    create: { organizationId: org, moduleId, enabled },
    update: { enabled },
  });
  return { ok: true };
}

/**
 * Define o ramo de atuação e LIGA (aditivo) os módulos daquele ramo + os core.
 * Não desliga nada — a empresa afina depois se quiser.
 */
export async function setOrgNiche(
  org: string,
  niche: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_NICHES.has(niche))
    return { ok: false, error: "Ramo de atuação inválido." };
  // Não deixa MIGRAR para um ramo fora da oferta — quem já está nele fica,
  // mas ninguém entra: os módulos ainda não existem.
  if (!isNicheAvailable(niche))
    return {
      ok: false,
      error: "Este ramo ainda não está disponível para novos espaços.",
    };

  const ids = [
    ...coreModules().map((m) => m.id),
    ...modulesForNiche(niche as NicheId).map((m) => m.id),
  ];

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org },
      data: { niche, nicheLabel: nicheLabel(niche as NicheId) },
    }),
    ...ids.map((moduleId) =>
      prisma.orgModule.upsert({
        where: { organizationId_moduleId: { organizationId: org, moduleId } },
        create: { organizationId: org, moduleId, enabled: true },
        update: { enabled: true },
      }),
    ),
  ]);
  return { ok: true };
}
