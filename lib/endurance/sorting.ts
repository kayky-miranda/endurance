/**
 * Ordenação de tabelas vinda da URL (?ord=campo&dir=asc|desc).
 *
 * Sem "server-only" de propósito: o tipo é usado no cliente (cabeçalho
 * clicável) e o parse roda no servidor (páginas). Não importa nada de UI,
 * então é testável isoladamente.
 *
 * FRONTEIRA DE SEGURANÇA: o campo resultante vai direto para o `orderBy` do
 * Prisma. `parseSort` só devolve valores da whitelist informada — qualquer
 * outra coisa vinda da URL vira o padrão da tela.
 */

export type SortDir = "asc" | "desc";
export type SortState = { field: string; dir: SortDir };

export function parseSort(
  sp: { ord?: string; dir?: string },
  allowed: readonly string[],
  fallback: SortState,
): SortState {
  const field = allowed.includes(sp.ord ?? "") ? (sp.ord as string) : fallback.field;
  const dir: SortDir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : fallback.dir;
  return { field, dir };
}

/**
 * Colunas ordenáveis da tabela de produtos (usada em Produtos e Estoque).
 *
 * Mora AQUI, e não no componente de tabela: aquele arquivo é "use client" e,
 * ao ser importado por um Server Component, o Next entrega uma referência de
 * cliente no lugar do array — o `includes` da whitelist quebraria em runtime.
 */
export const PRODUCT_SORT_FIELDS = [
  "name",
  "category",
  "price",
  "stock",
  "createdAt",
] as const;
