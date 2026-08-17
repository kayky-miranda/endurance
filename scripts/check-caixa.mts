/**
 * TESTE DO FECHAMENTO DE CAIXA, na camada de serviço.
 *
 * É aritmética que uma pessoa confere com dinheiro na mão: abertura, vendas em
 * dinheiro, suprimento, sangria e o esperado no fim. Um centavo errado aqui
 * vira discussão com o operador.
 *
 * Também confere o isolamento POR OPERADOR: o caixa de um não pode enxergar
 * nem sofrer sangria do outro.
 *
 * Dados ZZCX, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { openCash, addMovement, closeCash, getOpenSession } from "../lib/endurance/cash.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 56 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, detalhe = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!cond) falhas.push(desc + (detalhe ? " :: " + detalhe : ""));
};

let orgId = "";

try {
  h("preparo: uma empresa, dois operadores");
  const org = await prisma.organization.create({
    data: {
      slug: `zzcx-${Date.now()}`, name: "ZZCX", niche: "outro", nicheLabel: "Outro",
      locations: { create: { name: "Matriz", code: "MTZ", isDefault: true } },
    },
  });
  orgId = org.id;
  const mk = (nome: string) =>
    prisma.user.create({
      data: {
        organizationId: orgId, email: `zzcx.${nome}.${Date.now()}@exemplo.com`,
        name: `ZZCX ${nome}`, passwordHash: "x".repeat(60), role: "MEMBER",
        profile: "caixa", permissions: ["pdv.sell"],
      },
    });
  const ana = await mk("ana");
  const bruno = await mk("bruno");
  const prod = await prisma.product.create({
    data: { organizationId: orgId, name: "ZZCX Item", price: 25, stock: 500, sku: "ZZCX1" },
  });

  h("1. abertura");
  const a1 = await openCash(orgId, ana.id, 200);
  check(a1.ok === true, "Ana abre o caixa com R$ 200", a1.error ?? "");
  const a2 = await openCash(orgId, ana.id, 50);
  check(a2.ok === false, "Ana não abre um segundo caixa", a2.error ?? "");
  const b1 = await openCash(orgId, bruno.id, 100);
  check(b1.ok === true, "Bruno abre o caixa dele em paralelo", b1.error ?? "");

  const sAna = await getOpenSession(orgId, ana.id);
  const sBruno = await getOpenSession(orgId, bruno.id);
  check(sAna?.id !== sBruno?.id, "cada operador tem a própria sessão");

  h("2. vendas em dinheiro entram no esperado");
  // 3 vendas de R$ 25 em dinheiro no caixa da Ana + 1 no cartão (não conta).
  for (let i = 0; i < 3; i++) {
    await prisma.sale.create({
      data: {
        organizationId: orgId, userId: ana.id, cashSessionId: sAna!.id,
        subtotal: 25, discount: 0, total: 25, itemsCount: 1, change: 0,
        token: `zzcx-${i}-${Date.now()}`,
        items: { create: [{ productId: prod.id, name: prod.name, quantity: 1, unitPrice: 25 }] },
        payments: { create: [{ method: "dinheiro", amount: 25 }] },
      },
    });
  }
  await prisma.sale.create({
    data: {
      organizationId: orgId, userId: ana.id, cashSessionId: sAna!.id,
      subtotal: 25, discount: 0, total: 25, itemsCount: 1, change: 0,
      token: `zzcx-card-${Date.now()}`,
      items: { create: [{ productId: prod.id, name: prod.name, quantity: 1, unitPrice: 25 }] },
      payments: { create: [{ method: "credito", amount: 25 }] },
    },
  });

  h("3. suprimento e sangria");
  const sup = await addMovement(orgId, ana.id, "suprimento", 50, "ZZCX troco");
  check(sup.ok === true, "suprimento de R$ 50 aceito", sup.error ?? "");
  const san = await addMovement(orgId, ana.id, "sangria", 100, "ZZCX retirada");
  check(san.ok === true, "sangria de R$ 100 aceita", san.error ?? "");

  // 200 abertura + 75 dinheiro + 50 suprimento − 100 sangria = 225
  const excesso = await addMovement(orgId, ana.id, "sangria", 9999, "ZZCX exagero");
  check(excesso.ok === false, "recusa sangria maior que o disponível", excesso.error ?? "");

  for (const v of [0, -10]) {
    const r = await addMovement(orgId, ana.id, "sangria", v, "ZZCX inválido");
    check(r.ok === false, `recusa movimento de ${v}`, r.error ?? "");
  }

  h("4. fechamento com o valor exato");
  const esperadoAna = 200 + 75 + 50 - 100; // 225
  const f1 = await closeCash(orgId, ana.id, esperadoAna, "ZZCX conferido");
  check(f1.ok === true, "Ana fecha o caixa", f1.error ?? "");
  const fechadaAna = await prisma.cashSession.findUnique({ where: { id: sAna!.id } });
  check(Number(fechadaAna?.expectedAmount) === esperadoAna, `esperado = R$ ${esperadoAna}`, `veio ${fechadaAna?.expectedAmount}`);
  check(Number(fechadaAna?.difference) === 0, "diferença zero quando o contado bate", `veio ${fechadaAna?.difference}`);
  check(fechadaAna?.status === "fechado", "sessão fica fechada");

  h("5. cartão NÃO entra no dinheiro esperado");
  check(
    Number(fechadaAna?.expectedAmount) === esperadoAna,
    "venda no cartão ficou de fora do esperado em espécie",
    `esperado ${fechadaAna?.expectedAmount}, seria ${esperadoAna + 25} se contasse cartão`,
  );

  h("6. quebra de caixa (falta e sobra)");
  const s2 = await openCash(orgId, ana.id, 100);
  check(s2.ok === true, "Ana abre um novo caixa depois de fechar", s2.error ?? "");
  await closeCash(orgId, ana.id, 90, "ZZCX faltou");
  const falta = await prisma.cashSession.findFirst({
    where: { organizationId: orgId, userId: ana.id, status: "fechado" },
    orderBy: { closedAt: "desc" },
  });
  check(Number(falta?.difference) === -10, "falta de R$ 10 é registrada como -10", `veio ${falta?.difference}`);

  await openCash(orgId, ana.id, 100);
  await closeCash(orgId, ana.id, 115, "ZZCX sobrou");
  const sobra = await prisma.cashSession.findFirst({
    where: { organizationId: orgId, userId: ana.id, status: "fechado" },
    orderBy: { closedAt: "desc" },
  });
  check(Number(sobra?.difference) === 15, "sobra de R$ 15 é registrada como +15", `veio ${sobra?.difference}`);

  h("7. isolamento entre operadores");
  const brunoAinda = await getOpenSession(orgId, bruno.id);
  check(brunoAinda !== null, "o caixa do Bruno continua aberto depois de a Ana fechar o dela");
  check(Number(brunoAinda?.openingAmount) === 100, "abertura do Bruno intacta", `veio ${brunoAinda?.openingAmount}`);
  const fechaOutro = await closeCash(orgId, bruno.id, 100, "ZZCX bruno fecha o próprio");
  check(fechaOutro.ok === true, "Bruno fecha o próprio caixa", fechaOutro.error ?? "");
  const semCaixa = await addMovement(orgId, bruno.id, "sangria", 10, "ZZCX sem caixa");
  check(semCaixa.ok === false, "sem caixa aberto não dá para movimentar", semCaixa.error ?? "");

  h("8. centavos");
  await openCash(orgId, ana.id, 0.1);
  await prisma.sale.create({
    data: {
      organizationId: orgId, userId: ana.id,
      cashSessionId: (await getOpenSession(orgId, ana.id))!.id,
      subtotal: 0.2, discount: 0, total: 0.2, itemsCount: 1, change: 0,
      token: `zzcx-cent-${Date.now()}`,
      items: { create: [{ productId: prod.id, name: prod.name, quantity: 1, unitPrice: 0.2 }] },
      payments: { create: [{ method: "dinheiro", amount: 0.2 }] },
    },
  });
  await closeCash(orgId, ana.id, 0.3, "ZZCX centavos");
  const cent = await prisma.cashSession.findFirst({
    where: { organizationId: orgId, userId: ana.id, status: "fechado" },
    orderBy: { closedAt: "desc" },
  });
  check(Number(cent?.expectedAmount) === 0.3, "0,10 + 0,20 = 0,30 sem erro de ponto flutuante", `veio ${cent?.expectedAmount}`);
  check(Number(cent?.difference) === 0, "diferença zero em centavos", `veio ${cent?.difference}`);

  h("RESULTADO");
  if (!falhas.length) say("  Fechamento de caixa íntegro: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    const sessions = await prisma.cashSession.findMany({ where: { organizationId: orgId }, select: { id: true } });
    try { await prisma.cashMovement.deleteMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } }); } catch { /* ignora */ }
    for (const t of ["salePayment", "saleItem", "sale", "cashSession", "stockMovement", "productStock", "product", "location", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* ignora */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* ignora */ }
    say("\n[limpeza] dados ZZCX removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
