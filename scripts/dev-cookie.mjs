// Gera um JWT de sessão válido para um usuário (por e-mail), para validar
// fluxos autenticados fora do navegador top-level (ex.: preview em iframe, que
// bloqueia cookies SameSite=Lax em server actions). NÃO usar em produção.
//
// Uso: node --env-file=.env scripts/dev-cookie.mjs [email]
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const email = process.argv[2] || "ana@boacompra.com";
const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email },
  include: { organization: true },
});
if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({
  sub: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  org: user.organizationId,
  slug: user.organization.slug,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(secret);

console.log(token);
await prisma.$disconnect();
