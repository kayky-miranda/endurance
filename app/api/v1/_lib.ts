import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/endurance/api-keys";
import { hit } from "@/lib/rate-limit";

/**
 * Base da API pública v1 (autenticação por chave + rate limit por chave).
 *
 * Auth:   Authorization: Bearer edk_…
 * Limite: 120 requisições/minuto por chave (429 ao exceder).
 * Paginação: ?limit= (máx. 100) e ?cursor= (id do último item da página
 * anterior); a resposta traz `next_cursor` quando há mais páginas.
 */

export async function apiAuth(
  req: Request,
): Promise<{ org: string; keyId: string } | NextResponse> {
  const auth = await authenticateApiRequest(req);
  if (!auth)
    return NextResponse.json(
      { error: "unauthorized", message: "Chave de API ausente, inválida ou revogada." },
      { status: 401 },
    );
  const rate = await hit(`api:v1:${auth.keyId}`, 120, 60_000);
  if (!rate.ok)
    return NextResponse.json(
      { error: "rate_limited", message: "Limite de 120 req/min excedido." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  return auth;
}

export function parsePagination(req: Request): { limit: number; cursor: string | null } {
  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const cursor = url.searchParams.get("cursor");
  return { limit, cursor: cursor && cursor.length < 40 ? cursor : null };
}

export function pageResponse<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return NextResponse.json({
    data: page,
    next_cursor: hasMore ? page[page.length - 1].id : null,
  });
}
