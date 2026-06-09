import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({
  where: { slug: process.argv[2] || "mercado-boa-compra" },
});
const sales = await prisma.sale.findMany({
  where: { organizationId: org.id },
  include: { items: true, customer: true, payments: true },
  orderBy: { createdAt: "desc" },
});
console.log("SALES:", sales.length);
for (const s of sales) {
  console.log(
    `  sub=${s.subtotal} desc=${s.discount} total=${s.total} | cliente=${s.customer ? s.customer.name : "—"} | itens: ${s.items.map((i) => `${i.name} x${i.quantity}`).join(", ")} | pgto: ${s.payments.map((p) => `${p.method} ${p.amount}`).join(", ")}`,
  );
}
const customers = await prisma.customer.findMany({
  where: { organizationId: org.id },
});
console.log(
  "CUSTOMERS:",
  customers.map((c) => `${c.name} (${c.phone || "s/ tel"})`).join(", ") || "—",
);
const prods = await prisma.product.findMany({
  where: { organizationId: org.id },
});
console.log("STOCKS:", prods.map((p) => `${p.name}=${p.stock}`).join(", "));
await prisma.$disconnect();
