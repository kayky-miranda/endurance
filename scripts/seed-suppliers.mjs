// Cadastra fornecedores de demonstração. Uso:
//   node --env-file=.env scripts/seed-suppliers.mjs [slug]
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}

const existing = await prisma.supplier.count({ where: { organizationId: org.id } });
if (existing > 0) {
  console.log(`Já há ${existing} fornecedor(es); nada a fazer.`);
  await prisma.$disconnect();
  process.exit(0);
}

const demo = [
  { name: "Distribuidora Sul Alimentos", cnpj: "11222333000144", phone: "(19) 3344-5566", email: "vendas@distsul.com.br" },
  { name: "Atacadão Campinas", cnpj: "55666777000122", phone: "(19) 98888-1212", email: "comercial@atacadaocps.com.br" },
  { name: "Bebidas & Cia", cnpj: "99888777000133", phone: "(19) 3222-9090", email: "pedidos@bebidasecia.com.br" },
];
for (const s of demo) {
  await prisma.supplier.create({ data: { organizationId: org.id, ...s } });
}
console.log(`Fornecedores criados: ${demo.length}`);
await prisma.$disconnect();
