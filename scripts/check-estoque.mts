/**
 * TESTE DO RAZÃO DE ESTOQUE, na camada de serviço.
 *
 * A pergunta que importa: o saldo do produto sempre bate com a soma dos saldos
 * por local, e o livro de cada local é contínuo? Divergência aqui é prejuízo
 * silencioso — ninguém percebe até o inventário.
 *
 * CUIDADO ao escrever asserção aqui: `balanceBefore/balanceAfter` são saldos
 * DO LOCAL, não da rede. A primeira versão deste teste comparava com o total
 * do produto e acusou cinco falhas que não existiam, todas a partir do momento
 * em que apareceu uma segunda unidade.
 *
 * Dados prefixados com ZZEST e removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import {
  applyStockMovement,
  transferStock,
  InsufficientStockError,
} from "../lib/endurance/stock-ledger.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 58 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, detalhe = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!cond) falhas.push(desc + (detalhe ? " :: " + detalhe : ""));
};

let orgId = "";
const ator = { id: "zzest", name: "ZZEST Operador" };

/**
 * Invariantes do razão. Atenção ao que balanceBefore/After significam: são os
 * saldos DO LOCAL, não da rede (está documentado em stock-ledger.ts). Comparar
 * com o total do produto dá falso positivo assim que existe uma segunda
 * unidade.
 */
async function conferirInvariante(productId: string, etapa: string) {
  const prod = await prisma.product.findUnique({ where: { id: productId } });
  const porLocal = await prisma.productStock.findMany({ where: { productId } });
  const somaLocais = porLocal.reduce((a, r) => a + r.qty, 0);
  const total = prod?.stock ?? -1;
  check(
    total === somaLocais,
    `[${etapa}] produto (${total}) = soma dos locais (${somaLocais})`,
  );
  // Por LOCAL: o último movimento daquele local tem que bater com o saldo dele.
  for (const linha of porLocal) {
    const ultimo = await prisma.stockMovement.findFirst({
      where: { productId, locationId: linha.locationId },
      orderBy: { createdAt: "desc" },
    });
    if (ultimo)
      check(
        ultimo.balanceAfter === linha.qty,
        `[${etapa}] saldo do local ${linha.locationId.slice(-4)} (${linha.qty}) = último razão do local (${ultimo.balanceAfter})`,
      );
  }
  return total;
}

try {
  h("preparo");
  const org = await prisma.organization.create({
    data: {
      slug: `zzest-${Date.now()}`, name: "ZZEST", niche: "outro", nicheLabel: "Outro",
      locations: {
        create: [
          { name: "Matriz", code: "MTZ", isDefault: true },
          { name: "Filial", code: "FIL", isDefault: false },
        ],
      },
    },
    include: { locations: true },
  });
  orgId = org.id;
  const matriz = org.locations.find((l) => l.isDefault)!.id;
  const filial = org.locations.find((l) => !l.isDefault)!.id;
  const prod = await prisma.product.create({
    data: { organizationId: orgId, name: "ZZEST Item", price: 10, stock: 0, sku: "ZZE1" },
  });
  say(`  matriz=${matriz.slice(-6)} filial=${filial.slice(-6)}`);

  h("1. entrada de 100 na matriz");
  await prisma.$transaction((tx) =>
    applyStockMovement(tx, {
      organizationId: orgId, productId: prod.id, delta: 100, reason: "entrada",
      refType: "ajuste", locationId: matriz, actor: ator,
    }),
  );
  await conferirInvariante(prod.id, "entrada");

  h("2. transferência de 30 matriz → filial");
  const t = await transferStock(orgId, {
    productId: prod.id, fromLocationId: matriz, toLocationId: filial,
    quantity: 30, actor: ator,
  });
  check(t.ok === true, "transferência aceita", t.error ?? "");
  const total2 = await conferirInvariante(prod.id, "transferência");
  check(total2 === 100, "transferência NÃO altera o total da rede", `veio ${total2}`);
  const naFilial = await prisma.productStock.findFirst({ where: { productId: prod.id, locationId: filial } });
  check(naFilial?.qty === 30, "filial ficou com 30", `veio ${naFilial?.qty}`);

  h("3. transferir mais do que existe no local de origem");
  const t2 = await transferStock(orgId, {
    productId: prod.id, fromLocationId: filial, toLocationId: matriz,
    quantity: 999, actor: ator,
  });
  check(t2.ok === false, "recusa transferir além do saldo do local", t2.error ?? "");
  await conferirInvariante(prod.id, "após recusa");

  h("4. transferir para o MESMO local");
  const t3 = await transferStock(orgId, {
    productId: prod.id, fromLocationId: matriz, toLocationId: matriz,
    quantity: 5, actor: ator,
  });
  check(t3.ok === false, "recusa transferir para o mesmo local", t3.error ?? "");

  h("5. transferência com quantidade zero ou negativa");
  for (const q of [0, -5]) {
    const r = await transferStock(orgId, {
      productId: prod.id, fromLocationId: matriz, toLocationId: filial,
      quantity: q, actor: ator,
    });
    check(r.ok === false, `recusa transferência de ${q}`, r.error ?? "");
  }
  await conferirInvariante(prod.id, "após quantidades inválidas");

  h("6. venda maior que o saldo do LOCAL, menor que o da rede");
  // Filial tem 30, rede tem 100. Vender 50 na filial precisa falhar.
  let barrou = false;
  try {
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        organizationId: orgId, productId: prod.id, delta: -50, reason: "venda",
        refType: "sale", locationId: filial, actor: ator,
      }),
    );
  } catch (e) {
    barrou = e instanceof InsufficientStockError;
  }
  check(barrou, "venda de 50 na filial (tem 30) é barrada mesmo com 100 na rede");
  await conferirInvariante(prod.id, "após venda barrada");

  h("7. sequência longa: 40 movimentos alternados");
  for (let i = 0; i < 40; i++) {
    const delta = i % 2 === 0 ? 7 : -3;
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        organizationId: orgId, productId: prod.id, delta, reason: delta > 0 ? "entrada" : "venda",
        refType: "ajuste", locationId: matriz, actor: ator,
      }),
    );
  }
  const totalFinal = await conferirInvariante(prod.id, "após 40 movimentos");
  // 70 na matriz + 20×7 − 20×3 = 70 + 140 − 60 = 150; filial 30 → 180
  check(totalFinal === 180, "total confere com a aritmética esperada", `veio ${totalFinal}`);

  h("8. razão completo e encadeado");
  const movs = await prisma.stockMovement.findMany({
    where: { productId: prod.id }, orderBy: { createdAt: "asc" },
  });
  say(`  movimentos registrados: ${movs.length}`);
  // O encadeamento é POR LOCAL: o livro de cada unidade é contínuo.
  let encadeado = true;
  let quebra = "";
  const porLocalMovs = new Map<string, typeof movs>();
  for (const m of movs) {
    const k = m.locationId ?? "sem-local";
    porLocalMovs.set(k, [...(porLocalMovs.get(k) ?? []), m]);
  }
  for (const [loc, lista] of porLocalMovs) {
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].balanceBefore !== lista[i - 1].balanceAfter) {
        encadeado = false;
        quebra = `local ${loc.slice(-4)}, mov ${i}: antes=${lista[i].balanceBefore}, anterior terminou em ${lista[i - 1].balanceAfter}`;
        break;
      }
    }
  }
  check(encadeado, "o livro de cada local é contínuo", quebra);
  check(
    movs.every((m) => m.balanceAfter === m.balanceBefore + m.quantity),
    "saldo posterior = anterior + quantidade em todos os movimentos",
  );
  check(movs.every((m) => Boolean(m.userName)), "todo movimento tem responsável registrado");
  check(movs.every((m) => Boolean(m.locationId)), "todo movimento aponta um local");

  h("RESULTADO");
  if (!falhas.length) say("  Razão de estoque íntegro: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    for (const t of ["stockMovement", "productStock", "product", "location", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* ignora */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* ignora */ }
    say("\n[limpeza] dados ZZEST removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
