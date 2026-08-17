/**
 * TESTE DA CONCILIAÇÃO BANCÁRIA (OFX), da leitura do extrato até a baixa.
 *
 * O que importa aqui é dinheiro batendo: um lançamento não pode ser dado como
 * pago duas vezes, duas linhas do extrato não podem casar com a mesma conta, e
 * reimportar o mesmo extrato não pode gerar baixa nova.
 *
 * O parser já tem teste unitário. O que faltava era o CASAMENTO e a APLICAÇÃO,
 * que dependem de banco.
 *
 * Dados ZZOFX, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { buildOfxPreview, applyOfxReconciliation } from "../lib/endurance/ofx-reconcile.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 54 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, det = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${det ? " :: " + det : ""}`);
  if (!cond) falhas.push(desc + (det ? " :: " + det : ""));
};

let orgId = "";
const dia = (d: number) => new Date(2026, 7, d, 12, 0, 0);
const ofxDate = (d: number) => `202608${String(d).padStart(2, "0")}120000[-03:EST]`;

/** Monta um extrato OFX no sabor SGML, que é o que os bancos brasileiros mandam. */
function extrato(
  txs: { fitid: string; valor: number; d: number; memo: string }[],
): string {
  const corpo = txs
    .map(
      (t) => `<STMTTRN>
<TRNTYPE>${t.valor >= 0 ? "CREDIT" : "DEBIT"}
<DTPOSTED>${ofxDate(t.d)}
<TRNAMT>${t.valor.toFixed(2)}
<FITID>${t.fitid}
<MEMO>${t.memo}
</STMTTRN>`,
    )
    .join("\n");
  return `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>001<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
${corpo}
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
}

async function lancamento(kind: "receber" | "pagar", valor: number, d: number, desc: string) {
  return prisma.financialEntry.create({
    data: {
      organizationId: orgId, kind, description: desc, category: "ZZOFX",
      amount: valor, status: "pendente", dueDate: dia(d),
    },
  });
}

try {
  h("preparo");
  const org = await prisma.organization.create({
    data: { slug: `zzofx-${Date.now()}`, name: "ZZOFX", niche: "outro", nicheLabel: "Outro" },
  });
  orgId = org.id;

  const aReceber = await lancamento("receber", 1500, 10, "ZZOFX Cliente Alfa");
  const aPagar = await lancamento("pagar", 800, 12, "ZZOFX Fornecedor Beta");
  const foraDaJanela = await lancamento("receber", 2000, 1, "ZZOFX Antigo");
  say(`  3 lançamentos pendentes criados`);

  h("1. casamento por valor, sinal e data");
  const ofx1 = extrato([
    { fitid: "F001", valor: 1500, d: 10, memo: "TED RECEBIDA ALFA" },
    { fitid: "F002", valor: -800, d: 13, memo: "PAGTO BETA" },
    { fitid: "F003", valor: 77.77, d: 11, memo: "TARIFA SEM PAR" },
  ]);
  const p1 = await buildOfxPreview(orgId, ofx1);
  check(p1.total === 3, "leu as 3 linhas do extrato", `${p1.total}`);
  check(p1.bankId === "001", "leu o banco", p1.bankId);

  const l1 = p1.lines.find((l) => l.fitid === "F001")!;
  check(l1.kind === "receber", "crédito no extrato = a receber", l1.kind);
  check(l1.suggestion?.entryId === aReceber.id, "casou o recebimento certo", l1.suggestion?.description ?? "sem sugestão");
  check(l1.suggestion?.daysApart === 0, "mesma data = 0 dias de distância", `${l1.suggestion?.daysApart}`);

  const l2 = p1.lines.find((l) => l.fitid === "F002")!;
  check(l2.kind === "pagar", "débito no extrato = a pagar", l2.kind);
  check(l2.suggestion?.entryId === aPagar.id, "casou o pagamento certo", l2.suggestion?.description ?? "sem sugestão");
  check(l2.suggestion?.daysApart === 1, "1 dia de diferença é aceito", `${l2.suggestion?.daysApart}`);

  const l3 = p1.lines.find((l) => l.fitid === "F003")!;
  check(l3.suggestion === null, "linha sem par não recebe sugestão");
  check(p1.matched === 2, "duas linhas casadas", `${p1.matched}`);

  h("2. não casa valor igual com sinal trocado");
  const ofxSinal = extrato([{ fitid: "S1", valor: -1500, d: 10, memo: "SAIDA 1500" }]);
  const pSinal = await buildOfxPreview(orgId, ofxSinal);
  check(
    pSinal.lines[0].suggestion === null,
    "débito de 1500 NÃO casa com o recebível de 1500",
    pSinal.lines[0].suggestion?.description ?? "",
  );

  h("3. respeita a janela de dias");
  const ofxLonge = extrato([{ fitid: "L1", valor: 2000, d: 28, memo: "MUITO DEPOIS" }]);
  const pLonge = await buildOfxPreview(orgId, ofxLonge);
  check(
    pLonge.lines[0].suggestion === null,
    "lançamento fora da janela não é sugerido",
    pLonge.lines[0].suggestion?.description ?? "",
  );

  h("4. duas linhas do extrato não disputam o mesmo lançamento");
  const ofxDuplo = extrato([
    { fitid: "D1", valor: 1500, d: 10, memo: "PRIMEIRA" },
    { fitid: "D2", valor: 1500, d: 10, memo: "SEGUNDA IGUAL" },
  ]);
  const pDuplo = await buildOfxPreview(orgId, ofxDuplo);
  const s1 = pDuplo.lines[0].suggestion?.entryId;
  const s2 = pDuplo.lines[1].suggestion?.entryId;
  check(Boolean(s1), "a primeira linha casa", `${s1}`);
  check(s2 !== s1, "a segunda NÃO recebe o mesmo lançamento", `s1=${s1} s2=${s2}`);

  h("5. aplicação da baixa");
  const ap = await applyOfxReconciliation(orgId, [
    { fitid: "F001", entryId: aReceber.id },
    { fitid: "F002", entryId: aPagar.id },
  ]);
  check(ap.ok === true && ap.reconciled === 2, "duas baixas aplicadas", `${ap.reconciled}`);
  const r1 = await prisma.financialEntry.findUnique({ where: { id: aReceber.id } });
  check(r1?.status === "pago", "lançamento fica pago", `${r1?.status}`);
  check(r1?.externalRef === "F001", "guarda o FITID como referência externa", `${r1?.externalRef}`);
  check(Boolean(r1?.paidAt && r1?.reconciledAt), "grava data de pagamento e de conciliação");

  h("6. reimportar o MESMO extrato não gera baixa nova");
  const p2 = await buildOfxPreview(orgId, ofx1);
  const jaConciliadas = p2.lines.filter((l) => l.alreadyReconciled).map((l) => l.fitid);
  check(
    jaConciliadas.includes("F001") && jaConciliadas.includes("F002"),
    "as linhas já conciliadas vêm marcadas",
    jaConciliadas.join(","),
  );
  const ap2 = await applyOfxReconciliation(orgId, [
    { fitid: "F001", entryId: aReceber.id },
    { fitid: "F002", entryId: aPagar.id },
  ]);
  check(ap2.reconciled === 0, "aplicar de novo não dá baixa dupla", `${ap2.reconciled}`);

  h("7. lançamento pago não volta a ser sugerido");
  const p3 = await buildOfxPreview(orgId, extrato([{ fitid: "N1", valor: 1500, d: 10, memo: "OUTRA VEZ" }]));
  check(
    p3.lines[0].suggestion === null,
    "recebível já pago sai do conjunto de candidatos",
    p3.lines[0].suggestion?.description ?? "",
  );

  h("8. lançamento de outra empresa não entra");
  const outra = await prisma.organization.create({
    data: { slug: `zzofx-b-${Date.now()}`, name: "ZZOFX B", niche: "outro", nicheLabel: "Outro" },
  });
  const daOutra = await prisma.financialEntry.create({
    data: {
      organizationId: outra.id, kind: "receber", description: "ZZOFX da outra",
      category: "ZZOFX", amount: 999, status: "pendente", dueDate: dia(10),
    },
  });
  const pIso = await buildOfxPreview(orgId, extrato([{ fitid: "X1", valor: 999, d: 10, memo: "DA OUTRA" }]));
  check(pIso.lines[0].suggestion === null, "não sugere lançamento de outra empresa");
  const apIso = await applyOfxReconciliation(orgId, [{ fitid: "X1", entryId: daOutra.id }]);
  check(apIso.reconciled === 0, "não dá baixa em lançamento de outra empresa", `${apIso.reconciled}`);
  const intacto = await prisma.financialEntry.findUnique({ where: { id: daOutra.id } });
  check(intacto?.status === "pendente", "o lançamento da outra empresa fica intacto", `${intacto?.status}`);
  await prisma.financialEntry.deleteMany({ where: { organizationId: outra.id } });
  await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, outra.id);

  h("9. extrato vazio e lixo");
  const pVazio = await buildOfxPreview(orgId, extrato([]));
  check(pVazio.total === 0, "extrato sem transações devolve zero linhas", `${pVazio.total}`);
  const pLixo = await buildOfxPreview(orgId, "isso não é um OFX");
  check(pLixo.total === 0, "conteúdo inválido não quebra, devolve zero", `${pLixo.total}`);
  const apVazio = await applyOfxReconciliation(orgId, []);
  check(apVazio.ok === true && apVazio.reconciled === 0, "aplicar lista vazia é inofensivo");

  h("10. o lançamento antigo continua pendente");
  const antigo = await prisma.financialEntry.findUnique({ where: { id: foraDaJanela.id } });
  check(antigo?.status === "pendente", "nada foi conciliado por acidente", `${antigo?.status}`);

  h("RESULTADO");
  if (!falhas.length) say("  Conciliação íntegra: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    try { await prisma.financialEntry.deleteMany({ where: { organizationId: orgId } }); } catch { /* */ }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* */ }
    say("\n[limpeza] dados ZZOFX removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
