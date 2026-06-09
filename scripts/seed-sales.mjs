// Popula vendas de demonstração (últimos ~10 dias) para alimentar o painel
// executivo. NÃO baixa estoque (dado só para analytics). Uso:
//   node --env-file=.env scripts/seed-sales.mjs [slug]
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();

const org = await prisma.organization.findUnique({
  where: { slug },
  include: { products: true, users: true },
});
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}
if (org.products.length === 0) {
  console.error("Cadastre produtos antes (seed-products.mjs).");
  process.exit(1);
}

const seller = org.users.find((u) => u.role === "OWNER") || org.users[0];
await prisma.sale.deleteMany({ where: { organizationId: org.id } });

let customers = await prisma.customer.findMany({
  where: { organizationId: org.id },
});
if (customers.length < 3) {
  for (const [name, phone] of [
    ["Carla Dias", "41988887777"],
    ["Marcos Souza", "41977776666"],
    ["Juliana Reis", "41966665555"],
  ]) {
    customers.push(
      await prisma.customer.create({
        data: { organizationId: org.id, name, phone },
      }),
    );
  }
}

const methods = ["dinheiro", "credito", "debito", "pix"];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const round2 = (n) => Math.round(n * 100) / 100;

let made = 0;
for (let i = 0; i < 16; i++) {
  const when = new Date();
  when.setDate(when.getDate() - rnd(0, 9));
  when.setHours(rnd(9, 20), rnd(0, 59), 0, 0);

  const chosen = [];
  const used = new Set();
  for (let k = 0; k < rnd(1, 3); k++) {
    const p = pick(org.products);
    if (used.has(p.id)) continue;
    used.add(p.id);
    chosen.push({ p, qty: rnd(1, 3) });
  }
  if (chosen.length === 0) continue;

  const subtotal = round2(chosen.reduce((s, c) => s + c.p.price * c.qty, 0));
  const discount = Math.random() < 0.3 ? round2(subtotal * 0.05) : 0;
  const total = round2(subtotal - discount);
  const cust = Math.random() < 0.6 ? pick(customers) : null;

  await prisma.sale.create({
    data: {
      organizationId: org.id,
      userId: seller ? seller.id : null,
      customerId: cust ? cust.id : null,
      token: `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      subtotal,
      discount,
      total,
      itemsCount: chosen.reduce((s, c) => s + c.qty, 0),
      createdAt: when,
      items: {
        create: chosen.map((c) => ({
          productId: c.p.id,
          name: c.p.name,
          quantity: c.qty,
          unitPrice: c.p.price,
        })),
      },
      payments: { create: [{ method: pick(methods), amount: total }] },
    },
  });
  made++;
}
console.log(`Seeded ${made} vendas demo para ${slug}`);
await prisma.$disconnect();
