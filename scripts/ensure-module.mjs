// Garante que um espaço tenha um módulo ativo (OrgModule). Útil ao adicionar um
// módulo novo ao catálogo. Uso:
//   node --env-file=.env scripts/ensure-module.mjs <slug> <moduleId>
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2];
const moduleId = process.argv[3];
if (!slug || !moduleId) {
  console.error("Uso: ensure-module.mjs <slug> <moduleId>");
  process.exit(1);
}
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}
await prisma.orgModule.upsert({
  where: {
    organizationId_moduleId: { organizationId: org.id, moduleId },
  },
  create: { organizationId: org.id, moduleId, enabled: true },
  update: { enabled: true },
});
console.log(`Módulo "${moduleId}" garantido para ${slug}`);
await prisma.$disconnect();
