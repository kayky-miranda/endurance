import { PrismaClient } from "@prisma/client";

/**
 * Exclusão lógica global: Product, Customer e Supplier têm `deletedAt` e são
 * "apagados" marcando a data (o histórico — vendas, movimentações, pedidos —
 * continua íntegro). A extensão abaixo injeta `deletedAt: null` em toda
 * leitura desses modelos, para nenhuma listagem/busca vazar registro apagado.
 *
 * Para consultar apagados de propósito (ex.: auditoria/restauração), passe
 * `deletedAt` explicitamente no where — a extensão não sobrescreve.
 */
const SOFT_DELETE_MODELS = new Set([
  "Product",
  "Customer",
  "Supplier",
  "ClinicalNote",
  "MealPlan",
  "Anamnese",
  "WorkoutPlan",
  "Prescription",
]);

function makeClient() {
  const base = new PrismaClient();
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            model &&
            SOFT_DELETE_MODELS.has(model) &&
            (operation === "findMany" ||
              operation === "findFirst" ||
              operation === "count" ||
              operation === "aggregate" ||
              operation === "groupBy" ||
              operation === "updateMany")
          ) {
            const a = args as { where?: Record<string, unknown> };
            if (!a.where || !("deletedAt" in a.where))
              a.where = { ...(a.where ?? {}), deletedAt: null };
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof makeClient>;

/**
 * Tipo do client dentro de prisma.$transaction(async (tx) => …) do client
 * ESTENDIDO. Use este (e não Prisma.TransactionClient) em funções que
 * recebem `tx` — os tipos do client base não são compatíveis com a extensão.
 */
export type Tx = Parameters<
  Parameters<ExtendedClient["$transaction"]>[0] extends (tx: infer T) => unknown
    ? (tx: T) => unknown
    : never
>[0];

// Singleton — evita criar várias conexões no dev (hot reload do Next).
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
