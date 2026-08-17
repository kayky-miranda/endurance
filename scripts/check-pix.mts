/**
 * TESTE DA COBRANÇA PIX no modo simulado.
 *
 * Dinheiro que entra por confirmação externa tem dois riscos que não aparecem
 * na tela: a mesma venda gerando duas cobranças, e uma cobrança sendo
 * confirmada mais de uma vez. Os dois viram divergência de caixa.
 *
 * Dados ZZPIX, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import {
  createPixCharge,
  getPixChargeStatus,
  confirmSimulatedPix,
  cancelPixCharge,
  markPaid,
} from "../lib/endurance/pix-service.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 54 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, det = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${det ? " :: " + det : ""}`);
  if (!cond) falhas.push(desc + (det ? " :: " + det : ""));
};

let orgId = "";
const tok = (s: string) => `zzpix-${s}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

try {
  h("preparo");
  const org = await prisma.organization.create({
    data: { slug: `zzpix-${Date.now()}`, name: "ZZPIX", niche: "outro", nicheLabel: "Outro" },
  });
  orgId = org.id;
  say("  empresa criada (PIX em modo simulado, sem provedor)");

  h("1. criação da cobrança");
  const t1 = tok("a");
  const c1 = await createPixCharge(orgId, { token: t1, amount: 149.9 } as never);
  check(c1.ok === true, "cobrança criada", (c1 as { error?: string }).error ?? "");
  const ch1 = (c1 as { charge: { id: string; txid: string; status: string; amount: number } }).charge;
  check(ch1.status === "pendente", "nasce pendente", ch1.status);
  check(Number(ch1.amount) === 149.9, "guarda o valor com centavos", `${ch1.amount}`);
  check(Boolean(ch1.txid), "gera txid", ch1.txid);

  h("2. idempotência por token de venda");
  const c1b = await createPixCharge(orgId, { token: t1, amount: 149.9 } as never);
  const ch1b = (c1b as { charge: { id: string } }).charge;
  check(ch1b.id === ch1.id, "mesmo token devolve a MESMA cobrança", `${ch1b.id}`);
  const quantas = await prisma.pixCharge.count({ where: { organizationId: orgId, token: t1 } });
  check(quantas === 1, "não cria uma segunda cobrança para a mesma venda", `${quantas}`);

  h("3. valores inválidos");
  for (const v of [0, -10]) {
    const r = await createPixCharge(orgId, { token: tok("inv"), amount: v } as never);
    check(r.ok === false, `recusa cobrança de ${v}`, (r as { error?: string }).error ?? "");
  }
  const semToken = await createPixCharge(orgId, { token: "", amount: 50 } as never);
  check(semToken.ok === false, "recusa cobrança sem token", (semToken as { error?: string }).error ?? "");

  h("4. confirmação simulada");
  const conf = await confirmSimulatedPix(orgId, ch1.id);
  check(conf.ok === true, "confirma o pagamento", (conf as { error?: string }).error ?? "");
  const pago = await prisma.pixCharge.findUnique({ where: { id: ch1.id } });
  check(pago?.status === "pago", "fica paga", pago?.status);
  check(Boolean(pago?.paidAt), "grava o instante do pagamento");
  check(Boolean(pago?.e2eId), "grava o identificador da transação", pago?.e2eId ?? "");

  h("5. confirmar duas vezes");
  const primeiroPaidAt = pago?.paidAt?.getTime();
  const conf2 = await confirmSimulatedPix(orgId, ch1.id);
  check(conf2.ok === true, "segunda confirmação é idempotente (não vira erro)", (conf2 as { error?: string }).error ?? "");
  const pago2 = await prisma.pixCharge.findUnique({ where: { id: ch1.id } });
  check(
    pago2?.paidAt?.getTime() === primeiroPaidAt,
    "o instante do pagamento NÃO é sobrescrito",
    `${pago2?.paidAt?.toISOString()}`,
  );

  h("6. cancelar cobrança já paga");
  const canc = await cancelPixCharge(orgId, ch1.id);
  const depoisCanc = await prisma.pixCharge.findUnique({ where: { id: ch1.id } });
  say(`  cancelamento devolveu ok=${canc.ok}${canc.ok ? "" : " :: " + ((canc as { error?: string }).error ?? "")}`);
  check(
    depoisCanc?.status === "pago" || canc.ok === false,
    "cobrança paga não vira cancelada silenciosamente",
    `status=${depoisCanc?.status}`,
  );

  h("7. cancelar cobrança pendente");
  const t2 = tok("b");
  const c2 = await createPixCharge(orgId, { token: t2, amount: 30 } as never);
  const ch2 = (c2 as { charge: { id: string } }).charge;
  const canc2 = await cancelPixCharge(orgId, ch2.id);
  check(canc2.ok === true, "cancela cobrança pendente", (canc2 as { error?: string }).error ?? "");
  const cancelada = await prisma.pixCharge.findUnique({ where: { id: ch2.id } });
  check(cancelada?.status === "cancelado", "fica cancelada", cancelada?.status);

  h("8. confirmar cobrança cancelada");
  const confCanc = await confirmSimulatedPix(orgId, ch2.id);
  check(confCanc.ok === false, "cobrança cancelada não pode ser paga", (confCanc as { error?: string }).error ?? "");
  const aindaCanc = await prisma.pixCharge.findUnique({ where: { id: ch2.id } });
  check(aindaCanc?.status === "cancelado", "continua cancelada", aindaCanc?.status);

  h("9. consulta de status");
  const st = await getPixChargeStatus(orgId, ch1.id);
  check(st.ok === true, "consulta devolve a cobrança", (st as { error?: string }).error ?? "");
  const inexistente = await getPixChargeStatus(orgId, "id-que-nao-existe");
  check(inexistente.ok === false, "id inexistente não quebra", (inexistente as { error?: string }).error ?? "");

  h("10. markPaid grava o e2eId recebido");
  const t3 = tok("c");
  const c3 = await createPixCharge(orgId, { token: t3, amount: 77.5 } as never);
  const ch3 = (c3 as { charge: { id: string } }).charge;
  await markPaid(ch3.id, "E2E1234567890", new Date());
  const m3 = await prisma.pixCharge.findUnique({ where: { id: ch3.id } });
  check(m3?.status === "pago", "markPaid marca como paga", m3?.status);
  check(m3?.e2eId === "E2E1234567890", "guarda o e2eId do provedor", m3?.e2eId ?? "");

  h("11. cada cobrança tem txid próprio");
  const txids = (
    await prisma.pixCharge.findMany({ where: { organizationId: orgId }, select: { txid: true } })
  ).map((c) => c.txid);
  check(new Set(txids).size === txids.length, "nenhum txid repetido", `${txids.length} cobranças`);

  h("RESULTADO");
  if (!falhas.length) say("  Cobrança PIX íntegra: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    for (const t of ["pixCharge", "pixConfig"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* */ }
    say("\n[limpeza] dados ZZPIX removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
