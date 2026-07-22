import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Identificador de tabela QUALIFICADO PELO SCHEMA para uso em `$queryRaw`.
 *
 * O `?schema=` da connection string vale para o Prisma Client, mas NÃO define
 * o `search_path` da sessão no pooler do Neon (ele fica em `"$user", public`).
 * Sem qualificar, `FROM "Sale"` resolveria no schema `public` — outra tabela,
 * ou erro. Esta armadilha já causou um bug em produção (dashboard com dados
 * vazios), então TODO SQL cru do projeto passa por aqui.
 *
 *   prisma.$queryRaw`SELECT ... FROM ${T("Sale")} s WHERE ...`
 *
 * O nome do schema vem da nossa própria env e é escrito entre aspas duplas.
 */
export const DB_SCHEMA = (() => {
  const url = process.env.DATABASE_URL ?? "";
  const m = /[?&]schema=([^&]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : "public";
})();

export const T = (table: string) => Prisma.raw(`"${DB_SCHEMA}"."${table}"`);
