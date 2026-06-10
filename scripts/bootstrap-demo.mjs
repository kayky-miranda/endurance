// Cria o espaço de demonstração "mercado-boa-compra" com dono + módulos.
// Idempotente: se já existir, apenas reporta. Uso:
//   node --env-file=.env scripts/bootstrap-demo.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const slug = "mercado-boa-compra";
const email = "dono@boacompra.com";
const password = "senha123";

const MODULES = [
  "acesso", "financeiro", "crm", "notificacoes", "relatorios", "importacao",
  "pdv", "estoque", "caixa", "produtos", "precificacao", "fornecedores",
  "codigo_barras", "nfce", "nfe",
];

let org = await prisma.organization.findUnique({ where: { slug } });
if (org) {
  console.log(`Espaço já existe: ${slug}`);
} else {
  org = await prisma.organization.create({
    data: {
      slug,
      name: "Mercado Boa Compra",
      niche: "mercado_varejo",
      nicheLabel: "Mercado / Varejo",
      city: "Curitiba",
      state: "PR",
      country: "Brasil",
      segment: "mercadinho de bairro",
      modules: { create: MODULES.map((moduleId) => ({ moduleId, enabled: true })) },
      users: {
        create: {
          email,
          name: "Ana Proprietária",
          role: "OWNER",
          passwordHash: await bcrypt.hash(password, 10),
        },
      },
    },
  });
  console.log(`Espaço criado: ${slug} (${MODULES.length} módulos)`);
}
console.log(`LOGIN -> e-mail: ${email} | senha: ${password}`);
await prisma.$disconnect();
