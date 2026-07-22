import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const prod = await p.product.findFirst({ where: { name: "ZZTESTE Produto" } });
if (prod) {
  await p.stockMovement.deleteMany({ where: { productId: prod.id } });
  await p.productStock.deleteMany({ where: { productId: prod.id } });
  await p.product.delete({ where: { id: prod.id } });
}
const del = await p.location.deleteMany({ where: { name: "ZZTESTE Filial" } });
// confere integridade global: nenhum produto com soma de locais != total
const bad = await p.$queryRaw`
  SELECT COUNT(*)::int AS n FROM "Product" pr
  LEFT JOIN (SELECT "productId", SUM(qty)::int AS s FROM "ProductStock" GROUP BY "productId") t
    ON t."productId" = pr."id"
  WHERE COALESCE(t.s,0) <> pr."stock"`;
console.log(`limpeza ok (${del.count} local, 1 produto) — produtos com saldo divergente: ${bad[0].n}`);
await p.$disconnect();
