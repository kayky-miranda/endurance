import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const org = (await p.organization.findFirst({ where: { slug: "m-miranda" } })).id;

// Cria filial de teste
const filial = await p.location.create({ data: { organizationId: org, name: "ZZTESTE Filial", code: "ZZT" } });
const matriz = await p.location.findFirst({ where: { organizationId: org, isDefault: true } });

// Produto de teste com 10 un na matriz
const prod = await p.product.create({ data: { organizationId: org, name: "ZZTESTE Produto", barcode: "7899999900001", price: 10, cost: 5, stock: 0 } });
await p.productStock.create({ data: { organizationId: org, productId: prod.id, locationId: matriz.id, qty: 10 } });
await p.product.update({ where: { id: prod.id }, data: { stock: 10 } });

console.log("ANTES: matriz=10, filial=0, total=10");
await p.$disconnect();
console.log(JSON.stringify({ org, matriz: matriz.id, filial: filial.id, prod: prod.id }));
