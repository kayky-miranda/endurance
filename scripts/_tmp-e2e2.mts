import { prisma } from "../lib/db.ts";
import { transferStock, applyStockMovement, InsufficientStockError } from "../lib/endurance/stock-ledger.ts";

const ids = JSON.parse(process.argv[2]);
const show = async (label: string) => {
  const rows = await prisma.productStock.findMany({ where: { productId: ids.prod }, select: { locationId: true, qty: true } });
  const total = (await prisma.product.findUnique({ where: { id: ids.prod }, select: { stock: true } }))!.stock;
  const m = rows.find(r => r.locationId === ids.matriz)?.qty ?? 0;
  const f = rows.find(r => r.locationId === ids.filial)?.qty ?? 0;
  console.log(`${label}: matriz=${m} filial=${f} total=${total} ${m + f === total ? "✓ soma bate" : "✗ DIVERGENTE"}`);
};

await show("inicial      ");

// 1. Transferência 4 un matriz → filial
const t = await transferStock(ids.org, { productId: ids.prod, fromLocationId: ids.matriz, toLocationId: ids.filial, quantity: 4, actor: { id: "test", name: "TESTE" } });
console.log("transferir 4 matriz→filial:", t.ok ? "ok" : t.error);
await show("após transf. ");

// 2. Tentar transferir mais do que há na filial (deve falhar)
const t2 = await transferStock(ids.org, { productId: ids.prod, fromLocationId: ids.filial, toLocationId: ids.matriz, quantity: 99, actor: { id: "test", name: "TESTE" } });
console.log("transferir 99 da filial (só tem 4):", t2.ok ? "PERMITIU (BUG!)" : `bloqueado — ${t2.error}`);
await show("após recusa  ");

// 3. Venda na filial (baixa só de lá)
await prisma.$transaction(tx => applyStockMovement(tx, { organizationId: ids.org, productId: ids.prod, delta: -3, reason: "venda", refType: "sale", locationId: ids.filial, actor: { id: "test", name: "TESTE" } }));
await show("após venda 3 ");

// 4. Venda maior que o saldo da filial, mas menor que o total da rede (deve falhar)
try {
  await prisma.$transaction(tx => applyStockMovement(tx, { organizationId: ids.org, productId: ids.prod, delta: -5, reason: "venda", refType: "sale", locationId: ids.filial, actor: { id: "test", name: "TESTE" } }));
  console.log("venda de 5 na filial (tem 1, rede tem 7): PERMITIU (BUG!)");
} catch (e) {
  console.log(`venda de 5 na filial (tem 1, rede tem 7): bloqueado — ${e instanceof InsufficientStockError ? e.message : e}`);
}
await show("final        ");

const movs = await prisma.stockMovement.count({ where: { productId: ids.prod } });
console.log(`movimentos no razão: ${movs}`);
await prisma.$disconnect();
