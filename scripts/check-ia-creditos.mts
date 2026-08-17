/**
 * TESTE DOS CRÉDITOS DE IA.
 *
 * O código assume uma corrida de propósito e a documenta: a checagem de saldo
 * não é atômica, então chamadas simultâneas "podem estourar o teto por uma
 * unidade". Este teste existe para MEDIR esse excesso. Se for maior do que o
 * comentário promete, a afirmação está errada e o custo escapa.
 *
 * Também cobre o reembolso: falha nossa não pode consumir crédito do cliente.
 *
 * Dados ZZIA, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import {
  consumeAiCredit,
  refundAiCredit,
  getAiBalance,
  withAiCredit,
} from "../lib/endurance/ai-credits.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 54 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, det = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${det ? " :: " + det : ""}`);
  if (!cond) falhas.push(desc + (det ? " :: " + det : ""));
};

let orgId = "";
const usados = async () =>
  (await prisma.subscription.findFirst({ where: { organizationId: orgId } }))?.aiCreditsUsed ?? -1;

try {
  h("preparo: empresa com plano pago");
  const org = await prisma.organization.create({
    data: { slug: `zzia-${Date.now()}`, name: "ZZIA", niche: "outro", nicheLabel: "Outro" },
  });
  orgId = org.id;
  await prisma.subscription.create({
    data: {
      organizationId: orgId, plan: "professional", status: "active",
      aiCreditsUsed: 0, aiCreditsSince: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });
  const inicial = await getAiBalance(orgId);
  say(`  plano professional · cota ${inicial.included} · usados ${inicial.used}`);
  check(inicial.remaining === inicial.included, "começa com a cota inteira", `${inicial.remaining}`);

  h("1. consumo debita o custo do recurso");
  const antes = await usados();
  const c1 = await consumeAiCredit(orgId, "assistant");
  check(c1.ok === true, "consumo autorizado", (c1 as { error?: string }).error ?? "");
  const depois = await usados();
  check(depois > antes, "o contador subiu", `${antes} → ${depois}`);
  const custoAssistant = depois - antes;
  say(`  custo de "assistant": ${custoAssistant}`);

  h("2. reembolso devolve exatamente o mesmo custo");
  await refundAiCredit(orgId, "assistant");
  check(await usados() === antes, "voltou ao valor de antes", `${await usados()}`);

  h("3. reembolso não deixa o contador negativo");
  await refundAiCredit(orgId, "assistant");
  await refundAiCredit(orgId, "assistant");
  const naoNegativo = await usados();
  check(naoNegativo >= 0, "contador nunca fica negativo", `${naoNegativo}`);

  h("4. withAiCredit devolve o crédito quando nada foi entregue");
  const base = await usados();
  const semEntrega = await withAiCredit(orgId, "assistant", async () => ({
    value: null,
    delivered: false,
  }));
  check(semEntrega.ok === true, "a chamada retorna normalmente", "");
  check(
    await usados() === base,
    "falha nossa NÃO consome crédito do cliente",
    `${base} → ${await usados()}`,
  );

  const comEntrega = await withAiCredit(orgId, "assistant", async () => ({
    value: "resultado",
    delivered: true,
  }));
  check(comEntrega.ok === true, "entrega bem-sucedida retorna o valor");
  check(
    await usados() > base,
    "entrega real consome crédito",
    `${base} → ${await usados()}`,
  );

  h("5. bloqueio quando a cota acaba");
  const cota = (await getAiBalance(orgId)).included;
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: { aiCreditsUsed: cota, aiCreditsSince: new Date() },
  });
  const bloqueado = await consumeAiCredit(orgId, "assistant");
  check(bloqueado.ok === false, "cota esgotada bloqueia", (bloqueado as { error?: string }).error ?? "");
  check(
    ((bloqueado as { error?: string }).error ?? "").includes("upgrade"),
    "a mensagem diz o que fazer (upgrade)",
    (bloqueado as { error?: string }).error ?? "",
  );
  check(await usados() === cota, "tentativa bloqueada não debita nada", `${await usados()}`);

  h("6. MEDIÇÃO da corrida: 20 chamadas simultâneas com 3 créditos de folga");
  // O comentário do código promete estouro de "uma unidade". Aqui se mede.
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: { aiCreditsUsed: cota - 3, aiCreditsSince: new Date() },
  });
  const res = await Promise.all(
    Array.from({ length: 20 }, () => consumeAiCredit(orgId, "assistant")),
  );
  const autorizadas = res.filter((r) => r.ok).length;
  const finalUsado = await usados();
  const excesso = finalUsado - cota;
  say(`  autorizadas: ${autorizadas}/20 · usados ${finalUsado} de cota ${cota} · excesso ${excesso}`);
  // Com 3 créditos de folga e custo 2, cabe exatamente UMA chamada. Esperar
  // "3 ou mais" era erro de aritmética meu, não do código.
  const cabem = Math.floor(3 / custoAssistant);
  check(
    autorizadas === cabem,
    `passam exatamente as ${cabem} que cabem na folga`,
    `${autorizadas} autorizadas, custo ${custoAssistant}, folga 3`,
  );
  check(
    excesso <= 0,
    "o débito condicional impede QUALQUER estouro da cota",
    `excesso ${excesso}`,
  );
  if (excesso > 0) {
    say("");
    say(`  ⚠ REGRESSÃO: a cota foi estourada em ${excesso} créditos.`);
    say("     O débito é condicional (o teto vai no WHERE do UPDATE), então");
    say("     estouro aqui significa que alguém voltou a ler o saldo e");
    say("     incrementar depois. Foi assim que 20 chamadas simultâneas");
    say("     passaram todas e consumiram 37 créditos além da cota.");
    say("");
  }

  h("7. reinício da janela de cobrança");
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: { aiCreditsUsed: 9999, aiCreditsSince: new Date(Date.now() - 40 * 86400000) },
  });
  const janelaVencida = await getAiBalance(orgId);
  check(
    janelaVencida.remaining === janelaVencida.included,
    "janela vencida devolve a cota cheia",
    `${janelaVencida.remaining} de ${janelaVencida.included}`,
  );
  const apósVirada = await consumeAiCredit(orgId, "assistant");
  check(apósVirada.ok === true, "consumo volta a ser autorizado", (apósVirada as { error?: string }).error ?? "");
  const zerado = await usados();
  check(
    zerado < 9999,
    "o contador reiniciou em vez de somar sobre o ciclo antigo",
    `${zerado}`,
  );

  h("8. empresa sem assinatura");
  const semSub = await prisma.organization.create({
    data: { slug: `zzia-b-${Date.now()}`, name: "ZZIA B", niche: "outro", nicheLabel: "Outro" },
  });
  const saldoSemSub = await getAiBalance(semSub.id);
  say(`  sem assinatura: limite ${saldoSemSub.included} · restante ${saldoSemSub.remaining} · ilimitado=${saldoSemSub.unlimited}`);
  check(typeof saldoSemSub.remaining === "number", "não quebra sem assinatura");
  await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, semSub.id);

  h("RESULTADO");
  if (!falhas.length) say("  Créditos de IA íntegros: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    for (const t of ["aiUsage", "subscription"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* */ }
    say("\n[limpeza] dados ZZIA removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
