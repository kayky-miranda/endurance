"use server";

import { getSession, sessionHasPermission } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { hit } from "@/lib/rate-limit";
import { globalSearch, type SearchHit } from "@/lib/endurance/global-search";

/**
 * Busca global do topbar. Escopo por organização + módulos ativos + permissões
 * do perfil (definidas aqui, no servidor): o cliente só manda o termo. Rate
 * limit por usuário para não virar um scanner do banco.
 */
export async function globalSearchAction(term: string): Promise<SearchHit[]> {
  const session = await getSession();
  if (!session) return [];
  const q = (term ?? "").trim();
  if (q.length < 2) return [];

  if (!(await hit(`search:${session.sub}`, 30, 60_000)).ok) return [];

  const ws = await getWorkspace(session.slug);
  if (!ws) return [];
  const modules = new Set(ws.modules.map((m) => m.id));

  return globalSearch(session.org, q, {
    slug: session.slug,
    modules,
    canCustomers:
      sessionHasPermission(session, "customers.manage") ||
      sessionHasPermission(session, "pacientes.manage"),
    canProducts: sessionHasPermission(session, "products.manage"),
    canAgenda: sessionHasPermission(session, "agenda.manage"),
  });
}
