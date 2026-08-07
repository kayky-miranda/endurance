import "server-only";
import { prisma } from "@/lib/db";
import { AUDIT_DOMAINS, domainOf } from "./audit-taxonomy";

/**
 * Consulta da trilha de auditoria.
 *
 * A GRAVAÇÃO já existia (`logActivity`, ~130 pontos) — o que faltava era ler.
 * A única superfície de leitura era um bloco de 60 linhas na tela de Equipe,
 * anunciado como "ações na gestão de usuários" mas mostrando a organização
 * inteira: emissão fiscal, prontuário e caixa apareciam sob um título que dizia
 * outra coisa.
 *
 * A gravação continua acontecendo em TODO plano de propósito. Auditoria não se
 * liga retroativamente: se o registro só começasse ao contratar o Business, a
 * pergunta "quem apagou isso mês passado?" ficaria sem resposta justamente para
 * quem acabou de precisar dela. O que o plano libera é a CONSULTA.
 */

export interface AuditFilters {
  /** Id do domínio (ver AUDIT_DOMAINS). Vazio = todos. */
  domain?: string;
  /** Id do usuário que executou. */
  actorId?: string;
  /** Busca livre no detalhe e na ação. */
  q?: string;
  /** Dias para trás. */
  days?: number;
  page?: number;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  detail: string;
  targetId: string | null;
  createdAt: string;
  domainId: string;
  domainLabel: string;
  sensitive: boolean;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  /** Quem aparece na trilha do período — alimenta o filtro de autor. */
  actors: { id: string; name: string }[];
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLog(
  orgId: string,
  filters: AuditFilters = {},
): Promise<AuditPage> {
  const page = Math.max(1, filters.page ?? 1);
  const days = filters.days && filters.days > 0 ? filters.days : 90;
  const since = new Date(Date.now() - days * 86_400_000);

  // O domínio agrupa vários prefixos (`nfce.`, `nfe.`, `fiscal.`), então o
  // filtro vira um OR de startsWith — é o que permite a taxonomia crescer sem
  // mexer na consulta.
  const domain = AUDIT_DOMAINS.find((d) => d.id === filters.domain);
  const q = (filters.q ?? "").trim();

  const where = {
    organizationId: orgId,
    createdAt: { gte: since },
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(domain
      ? { OR: domain.prefixes.map((p) => ({ action: { startsWith: `${p}.` } })) }
      : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { detail: { contains: q, mode: "insensitive" as const } },
                { action: { contains: q, mode: "insensitive" as const } },
                { actorName: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : {}),
  };

  const [rows, total, actorRows] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    // Autores do PERÍODO, não da página: o filtro precisa oferecer todo mundo
    // que aparece na janela, senão só dá para filtrar por quem já está à vista.
    prisma.activityLog.findMany({
      where: { organizationId: orgId, createdAt: { gte: since } },
      distinct: ["actorId"],
      select: { actorId: true, actorName: true },
      take: 200,
    }),
  ]);

  return {
    entries: rows.map((r) => {
      const d = domainOf(r.action);
      return {
        id: r.id,
        actorId: r.actorId,
        actorName: r.actorName,
        action: r.action,
        detail: r.detail,
        targetId: r.targetId,
        createdAt: r.createdAt.toISOString(),
        domainId: d.id,
        domainLabel: d.label,
        sensitive: Boolean(d.sensitive),
      };
    }),
    total,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    actors: actorRows
      .filter((a): a is { actorId: string; actorName: string } => !!a.actorId)
      .map((a) => ({ id: a.actorId, name: a.actorName || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
