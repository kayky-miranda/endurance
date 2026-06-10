// Backfill dos recebíveis das vendas já existentes + contas a pagar de demo.
// Uso: node --env-file=.env scripts/seed-finance.mjs [slug]
import { PrismaClient } from "@prisma/client";

const slug = process.argv[2] || "mercado-boa-compra";
const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({ where: { slug } });
if (!org) {
  console.error(`Org não encontrada: ${slug}`);
  process.exit(1);
}

const PAY_LABEL = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};
const SETTLE_DAYS = { dinheiro: 0, pix: 0, debito: 1, credito: 30 };
const round2 = (n) => Math.round(n * 100) / 100;

// 1) Recebíveis das vendas que ainda não têm lançamento.
const sales = await prisma.sale.findMany({
  where: { organizationId: org.id },
  include: { payments: true },
});
let created = 0;
for (const s of sales) {
  const exists = await prisma.financialEntry.findFirst({
    where: { organizationId: org.id, saleId: s.id },
  });
  if (exists) continue;
  const code = `#${s.id.slice(-6).toUpperCase()}`;
  for (const p of s.payments) {
    if (p.amount <= 0) continue;
    const days = SETTLE_DAYS[p.method] ?? 0;
    const due = new Date(s.createdAt);
    due.setDate(due.getDate() + days);
    const settled = days === 0;
    await prisma.financialEntry.create({
      data: {
        organizationId: org.id,
        kind: "receber",
        description: `Venda ${code} · ${PAY_LABEL[p.method] ?? p.method}`,
        category: "Vendas",
        amount: round2(p.amount),
        status: settled ? "pago" : "pendente",
        method: p.method,
        saleId: s.id,
        dueDate: due,
        paidAt: settled ? s.createdAt : null,
      },
    });
    created++;
  }
}

// 2) Contas a pagar de demonstração (se ainda não houver nenhuma).
const payCount = await prisma.financialEntry.count({
  where: { organizationId: org.id, kind: "pagar" },
});
let pay = 0;
if (payCount === 0) {
  const today = new Date();
  const d = (offset) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return x;
  };
  const demo = [
    { description: "Aluguel da loja", category: "Despesa fixa", amount: 3500, dueDate: d(8) },
    { description: "Energia elétrica", category: "Utilidades", amount: 920.5, dueDate: d(3) },
    { description: "Fornecedor Distribuidora Sul", category: "Mercadorias", amount: 4780, dueDate: d(-2) },
    { description: "Internet e telefonia", category: "Utilidades", amount: 199.9, dueDate: d(12) },
    { description: "Salários equipe", category: "Folha", amount: 6200, dueDate: d(5) },
  ];
  for (const e of demo) {
    await prisma.financialEntry.create({
      data: { organizationId: org.id, kind: "pagar", status: "pendente", ...e },
    });
    pay++;
  }
}

console.log(`Recebíveis criados: ${created} · contas a pagar demo: ${pay}`);
await prisma.$disconnect();
