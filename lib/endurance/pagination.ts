/**
 * Paginação compartilhada das listas dos módulos (financeiro, fiscal, CRM…).
 * Sem "server-only": o componente <Pager> (client) importa o tipo PageMeta.
 */

export const PAGE_SIZE = 20;

export interface PageMeta {
  page: number;
  pageCount: number;
  total: number;
}

/** Normaliza o nº da página para o intervalo [1, última página]. */
export function clampPage(raw: number | undefined, total: number): number {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.floor(raw ?? 1);
  if (!Number.isFinite(p) || p < 1) return 1;
  return Math.min(p, last);
}

export function pageMeta(page: number, total: number): PageMeta {
  return { page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), total };
}

/** Lê um nº de página da query string (?pagina=2). Inválido → 1. */
export function parsePage(v: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
