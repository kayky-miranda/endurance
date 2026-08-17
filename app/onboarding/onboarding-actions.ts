"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  NICHES,
  allModuleIds,
  coreModules,
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
  /** Tipo de operação lido da descrição ("Indústria", "Distribuidora"...). */
  kind?: string;
}): Promise<R> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const valido = NICHES.some((n) => n.id === input.niche);
  const niche: NicheId | "outro" = valido
    ? (input.niche as NicheId)
    : "outro";

  // Valida contra o CATÁLOGO INTEIRO, não contra o ramo.
  //
  // O filtro por ramo era o que fazia a tela mentir: a análise identificava
  // produção, estoque, compras e fiscal numa indústria, o ramo caía em
  // "outro", e tudo que não fosse core era descartado aqui — a empresa
  // entrava com sete módulos e a barra lateral escrita "Outro / não
  // identificado". O ramo continua nomeando a empresa e sugerindo um pacote;
  // ele não decide mais o que ela pode ligar.
  //
  // A validação que importa continua de pé: id tem que existir no catálogo,
  // então nada que venha do cliente liga coisa inventada.
  const existentes = new Set(allModuleIds());
  const moduleIds = [
    ...new Set([
      ...coreModules().map((m) => m.id),
      ...(input.moduleIds ?? []).filter((id) => existentes.has(id)),
    ]),
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: session.org },
        data: {
          niche,
          // Quando o ramo não casa com nenhum do catálogo, o rótulo padrão é
          // "Outro / não identificado" — e uma indústria que acabou de
          // descrever a própria operação em detalhe merece coisa melhor do
          // que ver "não identificado" no topo da barra lateral. O tipo lido
          // da descrição nomeia a empresa; o ramo continua "outro" porque é
          // ele que decide o pacote sugerido, não o nome.
          nicheLabel:
            niche === "outro" && input.kind?.trim()
              ? input.kind.trim().slice(0, 60)
              : nicheLabel(niche),
          segment: (input.segment ?? "").trim().slice(0, 120),
        },
      });
      // Liga os módulos escolhidos sem desligar o que já existe: a etapa 1
      // criou o núcleo, e desligar aqui apagaria acesso que já foi concedido.
      //
      // Em DUAS consultas, não num upsert por módulo: o varejo sugere 23
      // módulos, e 23 idas ao banco dentro de uma transação é tempo de
      // resposta que o cliente sente na tela de resumo.
      await tx.orgModule.createMany({
        data: moduleIds.map((moduleId) => ({
          organizationId: session.org,
          moduleId,
          enabled: true,
        })),
        skipDuplicates: true,
      });
      await tx.orgModule.updateMany({
        where: { organizationId: session.org, moduleId: { in: moduleIds } },
        data: { enabled: true },
      });
    });
    return { ok: true };
  } catch (e) {
    logger.exception("Falha ao aplicar o onboarding", e);
    return { ok: false, error: "Não consegui salvar a configuração." };
  }
}
