// Cria (ou reusa) um usuário MEMBER e imprime um cookie de sessão assinado,
// para testar o RBAC no preview. Uso: node --env-file=.env scripts/make-member.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}

const email = "carlos@boacompra.com";
let user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  user = await prisma.user.create({
    data: {
      email,
      name: "Carlos Caixa",
      role: "MEMBER",
      organizationId: org.id,
      passwordHash: await bcrypt.hash("senha123", 10),
    },
  });
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({
  sub: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  org: org.id,
  slug,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(secret);

console.log("USERID=" + user.id);
console.log("COOKIE=" + token);
await prisma.$disconnect();
