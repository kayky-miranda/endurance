"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  NICHES,
  coreModules,
  modulesForNiche,
  nicheLabel,
  type NicheId,
} from "@/lib/endurance/catalog";
import { logger } from "@/lib/logger";

/**
 * ETAPA 2 do onboarding: grava o que a análise entendeu.
 *
 * Roda com a conta JÁ criada (etapa 1), então tem sessão e não precisa de
 * rate limit por IP: quem chega aqui já passou pelo cadastro.
 *
 * Revalida tudo contra o catálogo do servidor. A classificação vem de uma
 * chamada que o cliente dispara, e nada que volta de lá pode ligar módulo
 * fora do ramo nem inventar id.
 */

type R = { ok: true } | { ok: false; error: string };

export async function applyOnboardingAction(input: {
  niche: string;
  segment: string;
  moduleIds: string[];
  description: string;
}): Promise<R> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const valido = NICHES.some((n) => n.id === input.niche);
  const niche: NicheId | "outro" = valido
    ? (input.niche as NicheId)
    : "outro";

  // Só módulos que existem E pertencem ao core ou ao ramo escolhido.
  const permitidos = new Set<string>([
    ...coreModules().map((m) => m.id),
    ...(niche !== "outro" ? modulesForNiche(niche).map((m) => m.id) : []),
  ]);
  const moduleIds = [
    ...new Set((input.moduleIds ?? []).filter((id) => permitidos.has(id))),
  ];
  // Sem nada aproveitável, o núcleo garante um sistema utilizável.
  if (moduleIds.length === 0)
    moduleIds.push(...coreModules().map((m) => m.id));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: session.org },
        data: {
          niche,
          nicheLabel: nicheLabel(niche),
          segment: (input.segment ?? "").trim().slice(0, 120),
        },
      });
      // Liga os módulos escolhidos sem desligar o que já existe: a etapa 1
      // criou o núcleo, e desligar aqui apagaria acesso que já foi concedido.
      for (const moduleId of moduleIds) {
        await tx.orgModule.upsert({
          where: {
            organizationId_moduleId: { organizationId: session.org, moduleId },
          },
          create: { organizationId: session.org, moduleId, enabled: true },
          update: { enabled: true },
        });
      }
    });
    return { ok: true };
  } catch (e) {
    logger.exception("Falha ao aplicar o onboarding", e);
    return { ok: false, error: "Não consegui salvar a configuração." };
  }
}
