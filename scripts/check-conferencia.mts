/**
 * TESTE DA CONFERÊNCIA DE ESTOQUE (inventário), da contagem ao ajuste.
 *
 * É o único fluxo que ajusta saldo com base no que uma pessoa digitou, então a
 * pergunta é dupla: a máquina de estados impede ajustar o que não foi aprovado,
 * e o ajuste move exatamente a diferença — nem mais, nem duas vezes.
 *
 * Dados ZZCONF, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import {
  createCount,
  setCounted,
  transition,
  adjustCount,
  getCount,
} from "../lib/endurance/stock-count.ts";
import { applyStockMovement } from "../lib/endurance/stock-ledger.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 54 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, det = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${det ? " :: " + det : ""}`);
  if (!cond) falhas.push(desc + (det ? " :: " + det : ""));
};

let orgId = "";
const ator = { id: "zzconf", name: "ZZCONF Operador" };

try {
  h("preparo: 3 produtos com saldo conhecido");
  const org = await prisma.organization.create({
    data: {
      slug: `zzconf-${Date.now()}`, name: "ZZCONF", niche: "outro", nicheLabel: "Outro",
      locations: { create: { name: "Matriz", code: "MTZ", isDefault: true } },
    },
    include: { locations: true },
  });
  orgId = org.id;
  const local = org.locations[0].id;

  const criar = async (nome: string, qtd: number, sku: string) => {
    const p = await prisma.product.create({
      data: { organizationId: orgId, name: nome, price: 10, cost: 6, stock: 0, sku },
    });
    await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        organizationId: orgId, productId: p.id, delta: qtd, reason: "entrada",
        refType: "ajuste", locationId: local, actor: ator,
      }),
    );
    return p;
  };
  const sobra = await criar("ZZCONF Sobra", 100, "ZC1");   // vai contar 105
  const falta = await criar("ZZCONF Falta", 50, "ZC2");    // vai contar 42
  const exato = await criar("ZZCONF Exato", 30, "ZC3");     // vai contar 30
  say("  Sobra=100  Falta=50  Exato=30");

  h("1. abertura da conferência");
  const nova = await createCount({
    org: orgId, type: "geral", createdBy: ator, locationId: local,
    responsibleId: ator.id, responsibleName: ator.name, autoLoad: "geral",
  } as never);
  check(nova.ok === true, "conferência criada", (nova as { error?: string }).error ?? "");
  const countId = (nova as { id: string }).id;
  const carregada = await getCount(orgId, countId);
  check(carregada?.items.length === 3, "carregou os 3 produtos", `${carregada?.items.length}`);
  const sistemaSobra = carregada?.items.find((i) => i.productId === sobra.id)?.systemQty;
  check(sistemaSobra === 100, "gravou o saldo do sistema no momento da abertura", `${sistemaSobra}`);

  h("2. ajustar antes de aprovar é recusado");
  const cedo = await adjustCount(orgId, countId, ator);
  check(cedo.ok === false, "não ajusta conferência em rascunho", cedo.error ?? "");

  h("3. contagem");
  const itens = (await getCount(orgId, countId))!.items;
  const idDe = (pid: string) => itens.find((i) => i.productId === pid)!.id;
  for (const [pid, qtd] of [[sobra.id, 105], [falta.id, 42], [exato.id, 30]] as const) {
    const r = await setCounted(orgId, countId, idDe(pid), qtd, "");
    check(r.ok === true, `contou ${qtd}`, (r as { error?: string }).error ?? "");
  }

  h("4. máquina de estados");
  const pulo = await transition(orgId, countId, "ajustada" as never, ator);
  check(pulo.ok === false, "não pula direto de contagem para ajustada", pulo.error ?? "");
  const f1 = await transition(orgId, countId, "aguardando_aprovacao" as never, ator);
  check(f1.ok === true, "finaliza para aprovação", f1.error ?? "");
  const ajusteSemAprovar = await adjustCount(orgId, countId, ator);
  check(ajusteSemAprovar.ok === false, "aguardando aprovação ainda não ajusta", ajusteSemAprovar.error ?? "");
  const f2 = await transition(orgId, countId, "aprovada" as never, ator);
  check(f2.ok === true, "aprova", f2.error ?? "");
  const aprovada = await prisma.stockCount.findUnique({ where: { id: countId } });
  check(Boolean(aprovada?.approvedAt && aprovada?.approvedByName), "registra quem aprovou e quando");

  h("5. o ajuste move exatamente a diferença");
  const aj = await adjustCount(orgId, countId, ator);
  check(aj.ok === true, "ajuste aplicado", aj.error ?? "");
  check(aj.adjusted === 2, "só os 2 divergentes entraram", `${aj.adjusted}`);

  const pSobra = await prisma.product.findUnique({ where: { id: sobra.id } });
  const pFalta = await prisma.product.findUnique({ where: { id: falta.id } });
  const pExato = await prisma.product.findUnique({ where: { id: exato.id } });
  check(pSobra?.stock === 105, "sobra: 100 → 105", `${pSobra?.stock}`);
  check(pFalta?.stock === 42, "falta: 50 → 42", `${pFalta?.stock}`);
  check(pExato?.stock === 30, "sem divergência, nada muda", `${pExato?.stock}`);

  h("6. rastro do ajuste no razão");
  const movs = await prisma.stockMovement.findMany({
    where: { organizationId: orgId, reason: "inventario" },
  });
  check(movs.length === 2, "dois movimentos de inventário", `${movs.length}`);
  const mSobra = movs.find((m) => m.productId === sobra.id);
  const mFalta = movs.find((m) => m.productId === falta.id);
  check(mSobra?.quantity === 5, "sobra registrada como +5", `${mSobra?.quantity}`);
  check(mFalta?.quantity === -8, "falta registrada como -8", `${mFalta?.quantity}`);
  check(movs.every((m) => m.refType === "stock_count" && m.refId === countId), "movimento aponta a conferência de origem");
  check(movs.every((m) => m.userName === ator.name), "movimento registra quem aprovou o ajuste");
  check(
    movs.every((m) => m.note.includes(aprovada!.number)),
    "a nota do movimento cita o número da conferência",
    movs[0]?.note,
  );

  h("7. ajustar duas vezes NÃO duplica");
  const aj2 = await adjustCount(orgId, countId, ator);
  check(aj2.ok === false, "conferência já ajustada é recusada", aj2.error ?? "");
  const pSobra2 = await prisma.product.findUnique({ where: { id: sobra.id } });
  check(pSobra2?.stock === 105, "saldo continua 105, não 110", `${pSobra2?.stock}`);
  const movs2 = await prisma.stockMovement.count({
    where: { organizationId: orgId, reason: "inventario" },
  });
  check(movs2 === 2, "continuam 2 movimentos de inventário", `${movs2}`);

  h("8. contagem zero é diferente de item não contado");
  const nova2 = await createCount({
    org: orgId, type: "geral", createdBy: ator, locationId: local,
    responsibleId: ator.id, responsibleName: ator.name, autoLoad: "geral",
  } as never);
  const id2 = (nova2 as { id: string }).id;
  const itens2 = (await getCount(orgId, id2))!.items;
  // Conta ZERO no produto "Exato" (achou nada na prateleira) e não conta os outros.
  const alvo = itens2.find((i) => i.productId === exato.id)!;
  await setCounted(orgId, id2, alvo.id, 0, "não achei nenhum");
  await transition(orgId, id2, "aguardando_aprovacao" as never, ator);
  await transition(orgId, id2, "aprovada" as never, ator);
  const aj3 = await adjustCount(orgId, id2, ator);
  check(aj3.ok === true, "ajuste da segunda conferência aplicado", aj3.error ?? "");
  check(aj3.adjusted === 1, "só o item contado entrou (os não contados ficam de fora)", `${aj3.adjusted}`);
  const pExato2 = await prisma.product.findUnique({ where: { id: exato.id } });
  check(pExato2?.stock === 0, "contagem zero zera o saldo mesmo", `${pExato2?.stock}`);
  const pSobra3 = await prisma.product.findUnique({ where: { id: sobra.id } });
  check(pSobra3?.stock === 105, "item não contado não foi zerado por engano", `${pSobra3?.stock}`);

  h("9. conferência de outra empresa");
  const outra = await prisma.organization.create({
    data: { slug: `zzconf-b-${Date.now()}`, name: "ZZCONF B", niche: "outro", nicheLabel: "Outro" },
  });
  const cruzado = await adjustCount(outra.id, countId, ator);
  check(cruzado.ok === false, "outra empresa não ajusta esta conferência", cruzado.error ?? "");
  const lida = await getCount(outra.id, countId);
  check(lida === null, "outra empresa não lê esta conferência");
  await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, outra.id);

  h("RESULTADO");
  if (!falhas.length) say("  Conferência de estoque íntegra: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    const cs = await prisma.stockCount.findMany({ where: { organizationId: orgId }, select: { id: true } });
    try { await prisma.stockCountItem.deleteMany({ where: { stockCountId: { in: cs.map((c) => c.id) } } }); } catch { /* */ }
    for (const t of ["stockCount", "stockMovement", "productStock", "product", "location"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* */ }
    say("\n[limpeza] dados ZZCONF removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
