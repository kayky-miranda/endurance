import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { E2E_EMAIL_DOMAIN } from "./helpers";

/**
 * Apaga as organizações criadas pelos testes (donos com e-mail no domínio
 * reservado). O delete em Organization cascateia usuários, produtos, vendas,
 * documentos fiscais, caixa e financeiro.
 */
export default async function globalTeardown(): Promise<void> {
  loadEnvConfig(process.cwd());
  const prisma = new PrismaClient();
  try {
    const owners = await prisma.user.findMany({
      where: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
      select: { organizationId: true },
    });
    const ids = Array.from(new Set(owners.map((o) => o.organizationId)));
    if (ids.length > 0) {
      const res = await prisma.organization.deleteMany({
        where: { id: { in: ids } },
      });
      console.info(`[e2e:teardown] ${res.count} organização(ões) removida(s).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
