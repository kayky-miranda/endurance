import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const locs = await p.location.count();
const orgs = await p.organization.count();
const ps = await p.productStock.count();
const prods = await p.product.count();
const mismatch = await p.$queryRaw`
  SELECT COUNT(*)::int AS n FROM "Product" pr
  LEFT JOIN (SELECT "productId", SUM(qty)::int AS s FROM "ProductStock" GROUP BY "productId") t
    ON t."productId" = pr."id"
  WHERE COALESCE(t.s, 0) <> pr."stock"`;
console.log({ orgs, locs, prods, productStocks: ps, saldosDivergentes: mismatch[0].n });
await p.$disconnect();
