// Popula produtos de demonstração (com código de barras) para um espaço.
// Limpa os produtos existentes do espaço antes. Uso:
//   node --env-file=.env scripts/seed-products.mjs [slug]
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();

const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}

await prisma.sale.deleteMany({ where: { organizationId: org.id } });
await prisma.customer.deleteMany({ where: { organizationId: org.id } });
await prisma.product.deleteMany({ where: { organizationId: org.id } });

const demo = [
  { name: "Arroz 5kg", barcode: "7891000100101", category: "Mercearia", price: 27.9, cost: 19.9, stock: 40 },
  { name: "Feijão 1kg", barcode: "7891000100102", category: "Mercearia", price: 8.5, cost: 5.5, stock: 60 },
  { name: "Refrigerante 2L", barcode: "7891000100103", category: "Bebidas", price: 9.9, cost: 6.5, stock: 4 },
  { name: "Detergente", barcode: "7891000100104", category: "Limpeza", price: 3.2, cost: 1.9, stock: 2 },
  { name: "Café 500g", barcode: "7891000100105", category: "Mercearia", price: 18.0, cost: 12.0, stock: 25 },
];

for (const d of demo) {
  await prisma.product.create({ data: { organizationId: org.id, ...d } });
}
console.log(`Seeded ${demo.length} produtos (com código de barras) para ${slug}`);
await prisma.$disconnect();
