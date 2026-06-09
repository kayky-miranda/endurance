// Popula a configuração fiscal (emitente NFC-e) do espaço de demonstração.
// Uso: node --env-file=.env scripts/seed-fiscal.mjs [slug]
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}

const data = {
  cnpj: "12345678000199",
  razaoSocial: "Mercado Boa Compra Comércio de Alimentos LTDA",
  nomeFantasia: org.name,
  ie: "112233445566",
  crt: "1",
  uf: "SP",
  cMun: "3509502",
  municipio: org.city || "Campinas",
  serie: 1,
  ambiente: "2",
  cscId: "000001",
  csc: "G8KP2M5QX7VTBN3RWA9CDEF1HJ4LZY6S",
};

await prisma.fiscalConfig.upsert({
  where: { organizationId: org.id },
  create: { organizationId: org.id, ...data },
  update: data,
});

console.log(`Config fiscal NFC-e populada para ${slug} (CNPJ ${data.cnpj}).`);
await prisma.$disconnect();
