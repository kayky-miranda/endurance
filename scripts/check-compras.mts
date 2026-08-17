/**
 * TESTE DA CADEIA DE COMPRAS ponta a ponta, pela camada de serviço.
 * Solicitação → aprovação → cotação → pedido → recebimento → estoque + a pagar.
 * Tudo prefixado com ZZCOMPRAS e removido no fim.
 */
import { prisma } from "../lib/db.ts";
import { createRequisition, submitForApproval } from "../lib/endurance/requisitions.ts";
import { listPendingApprovals, decideApproval } from "../lib/endurance/approvals.ts";
import { createQuotation, saveSupplierBid, chooseWinner } from "../lib/endurance/quotations.ts";
import { generateFromQuotation, sendOrder } from "../lib/endurance/purchase-orders.ts";
import { getReceivingTarget, receiveOrder } from "../lib/endurance/receiving.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 60 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, detalhe = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!cond) falhas.push(desc + (detalhe ? " :: " + detalhe : ""));
};

const ator = { id: "", name: "ZZCOMPRAS Comprador" };
let orgId = "";

try {
  h("preparo");
  const org = await prisma.organization.create({
    data: {
      slug: `zzcompras-${Date.now()}`, name: "ZZCOMPRAS Ind", niche: "outro",
      nicheLabel: "Indústria", locations: { create: { name: "Matriz", code: "MTZ", isDefault: true } },
    },
  });
  orgId = org.id;
  const user = await prisma.user.create({
    data: {
      organizationId: orgId, email: `zzcompras.${Date.now()}@exemplo.com`,
      name: "ZZCOMPRAS Comprador", passwordHash: "x".repeat(60), role: "OWNER",
      profile: "administrador", permissions: [],
    },
  });
  ator.id = user.id;
  const prod = await prisma.product.create({
    data: { organizationId: orgId, name: "ZZCOMPRAS Chapa de aço", price: 100, stock: 0, sku: "ZZC1" },
  });
  const forn = await prisma.supplier.create({
    data: { organizationId: orgId, name: "ZZCOMPRAS Metalúrgica", paymentTermDays: 30 },
  });
  say(`  org=${org.slug} produto=${prod.name} (estoque inicial ${prod.stock})`);

  h("1. solicitação de compra");
  const req = await createRequisition(orgId, ator, {
    items: [{ productId: prod.id, name: prod.name, quantity: 10, estimatedUnit: 250 }],
    priority: "alta",
    note: "ZZCOMPRAS reposição de matéria-prima",
  } as never);
  check(req.ok === true, "solicitação criada", req.error ?? "");
  const reqId = req.id!;

  h("2. envio para aprovação (valor decide o nível)");
  const sub = await submitForApproval(orgId, reqId);
  check(sub.ok === true, "enviada para aprovação", sub.error ?? "");
  // 10 × 250 = 2.500 → até 5.000 = supervisor
  check(sub.level === "supervisor", `nível exigido = supervisor (R$ 2.500)`, `veio "${sub.level}"`);

  const dup = await submitForApproval(orgId, reqId);
  check(dup.ok === false, "não deixa enviar a mesma solicitação duas vezes", dup.error ?? "");

  h("3. aprovação");
  const pend = await listPendingApprovals(orgId);
  check(pend.rows.length === 1, "aparece 1 aprovação pendente", `veio ${pend.rows.length}`);
  const apId = pend.rows[0]?.approvalId;
  const dec = await decideApproval(orgId, apId, "aprovar" as never, ator, "ZZCOMPRAS ok");
  check(dec.ok === true, "aprovada", dec.error ?? "");
  const dec2 = await decideApproval(orgId, apId, "aprovar" as never, ator, "de novo");
  check(dec2.ok === false, "não deixa decidir a mesma aprovação duas vezes", dec2.error ?? "");

  h("4. cotação");
  const cot = await createQuotation(orgId, { requisitionId: reqId, supplierIds: [forn.id] });
  check(cot.ok === true, "cotação criada a partir da solicitação", cot.error ?? "");
  const cotId = cot.id!;

  const qd = await prisma.quotation.findUnique({
    where: { id: cotId }, include: { items: true, suppliers: true },
  });
  const bid = await saveSupplierBid(orgId, qd!.suppliers[0].id, {
    leadTimeDays: 5,
    prices: qd!.items.map((it) => ({ quotationItemId: it.id, unitPrice: 230 })),
  });
  check(bid.ok === true, "proposta do fornecedor registrada", bid.error ?? "");

  const win = await chooseWinner(orgId, cotId, forn.id);
  check(win.ok === true, "vencedor escolhido e cotação fechada", win.error ?? "");
  const reqDepois = await prisma.purchaseRequisition.findUnique({ where: { id: reqId } });
  check(reqDepois?.status === "convertida", "ao fechar a cotação a solicitação vira 'convertida'", `status=${reqDepois?.status}`);

  h("5. pedido de compra");
  const ped = await generateFromQuotation(orgId, cotId);
  check(ped.ok === true, "pedido gerado da cotação", ped.error ?? "");
  const pedId = ped.id!;
  const ped2 = await generateFromQuotation(orgId, cotId);
  check(ped2.id === pedId, "gerar de novo devolve o MESMO pedido (não duplica)", `${ped2.id}`);

  const pedRow = await prisma.purchaseOrder.findUnique({ where: { id: pedId }, include: { items: true } });
  check(Number(pedRow?.total) === 2300, "total do pedido = 10 × 230 = 2.300", `veio ${pedRow?.total}`);

  const env = await sendOrder(orgId, pedId);
  check(env.ok === true, "pedido enviado ao fornecedor", env.error ?? "");

  h("6. recebimento PARCIAL (6 de 10)");
  const alvo = await getReceivingTarget(orgId, pedId);
  const itemId = alvo!.items[0].id;
  const rec1 = await receiveOrder(orgId, pedId, [{ orderItemId: itemId, qtyReceived: 6, qualityOk: true }], ator, "ZZCOMPRAS parcial");
  check(rec1.ok === true, "recebimento parcial aceito", rec1.error ?? "");
  check(rec1.status === "parcial", "pedido fica 'parcial'", `status=${rec1.status}`);
  check(rec1.payable === 1380, "a pagar do parcial = 6 × 230 = 1.380", `veio ${rec1.payable}`);

  const p1 = await prisma.product.findUnique({ where: { id: prod.id } });
  check(p1?.stock === 6, "estoque subiu para 6", `veio ${p1?.stock}`);

  h("7. tenta receber MAIS do que falta (pede 20, faltam 4)");
  const rec2 = await receiveOrder(orgId, pedId, [{ orderItemId: itemId, qtyReceived: 20, qualityOk: true }], ator, "ZZCOMPRAS excesso");
  check(rec2.ok === true, "aceita e limita ao que falta", rec2.error ?? "");
  const p2 = await prisma.product.findUnique({ where: { id: prod.id } });
  check(p2?.stock === 10, "estoque final = 10, não 26", `veio ${p2?.stock}`);
  check(rec2.status === "recebido", "pedido fecha como 'recebido'", `status=${rec2.status}`);

  h("8. recebimento depois de fechado");
  const rec3 = await receiveOrder(orgId, pedId, [{ orderItemId: itemId, qtyReceived: 1, qualityOk: true }], ator, "ZZCOMPRAS extra");
  check(rec3.ok === false, "recusa receber pedido já fechado", rec3.error ?? "");

  h("9. financeiro e razão de estoque");
  const contas = await prisma.financialEntry.findMany({ where: { organizationId: orgId, kind: "pagar" } });
  const totalPagar = contas.reduce((a, c) => a + Number(c.amount), 0);
  check(contas.length === 2, "duas contas a pagar (uma por recebimento)", `veio ${contas.length}`);
  check(Math.round(totalPagar) === 2300, "soma das contas = total do pedido", `veio ${totalPagar}`);
  const venc = contas[0]?.dueDate ? Math.round((contas[0].dueDate.getTime() - Date.now()) / 86400000) : -1;
  check(venc >= 29 && venc <= 30, "vencimento respeita o prazo do fornecedor (30 dias)", `veio ${venc} dias`);

  const movs = await prisma.stockMovement.findMany({ where: { productId: prod.id }, orderBy: { createdAt: "asc" } });
  check(movs.length === 2, "duas movimentações no razão", `veio ${movs.length}`);
  check(movs.every((m) => m.reason === "recebimento"), "movimentações marcadas como 'recebimento'");
  const ultima = movs[movs.length - 1];
  check(ultima?.balanceAfter === 10, "saldo posterior do razão bate com o produto", `veio ${ultima?.balanceAfter}`);

  h("10. qualidade reprovada NÃO entra no estoque");
  const req2 = await createRequisition(orgId, ator, {
    items: [{ productId: prod.id, name: prod.name, quantity: 4, estimatedUnit: 230 }],
    priority: "media", note: "ZZCOMPRAS segunda compra",
  } as never);
  await submitForApproval(orgId, req2.id!);
  const pend2 = await listPendingApprovals(orgId);
  await decideApproval(orgId, pend2.rows[0].approvalId, "aprovar" as never, ator, "ok");
  const cotB = await createQuotation(orgId, { requisitionId: req2.id!, supplierIds: [forn.id] });
  const qdB = await prisma.quotation.findUnique({ where: { id: cotB.id! }, include: { items: true, suppliers: true } });
  await saveSupplierBid(orgId, qdB!.suppliers[0].id, {
    leadTimeDays: 2, prices: qdB!.items.map((it) => ({ quotationItemId: it.id, unitPrice: 230 })),
  });
  await chooseWinner(orgId, cotB.id!, forn.id);
  const pedB = await generateFromQuotation(orgId, cotB.id!);
  await sendOrder(orgId, pedB.id!);
  const alvoB = await getReceivingTarget(orgId, pedB.id!);
  const recB = await receiveOrder(orgId, pedB.id!, [{ orderItemId: alvoB!.items[0].id, qtyReceived: 4, qualityOk: false }], ator, "ZZCOMPRAS avariado");
  check(recB.ok === true, "recebimento com qualidade reprovada é registrado", recB.error ?? "");
  const p3 = await prisma.product.findUnique({ where: { id: prod.id } });
  check(p3?.stock === 10, "estoque NÃO sobe com item reprovado", `veio ${p3?.stock}`);
  check(recB.payable === 0, "não gera conta a pagar do que foi reprovado", `veio ${recB.payable}`);
  check(recB.status === "recebido", "pedido fecha (conferido, ainda que reprovado)", `status=${recB.status}`);

  h("11. RISCO: duas cotações da MESMA solicitação");
  const reqC = await createRequisition(orgId, ator, {
    items: [{ productId: prod.id, name: prod.name, quantity: 5, estimatedUnit: 200 }],
    priority: "baixa", note: "ZZCOMPRAS terceira",
  } as never);
  await submitForApproval(orgId, reqC.id!);
  const pend3 = await listPendingApprovals(orgId);
  await decideApproval(orgId, pend3.rows[0].approvalId, "aprovar" as never, ator, "ok");

  const cotX = await createQuotation(orgId, { requisitionId: reqC.id!, supplierIds: [forn.id] });
  const cotY = await createQuotation(orgId, { requisitionId: reqC.id!, supplierIds: [forn.id] });
  say(`  cotação A: ${cotX.ok ? "criada" : cotX.error}`);
  say(`  cotação B da MESMA solicitação: ${cotY.ok ? "criada" : cotY.error}`);

  if (cotX.ok && cotY.ok) {
    for (const c of [cotX.id!, cotY.id!]) {
      const qq = await prisma.quotation.findUnique({ where: { id: c }, include: { items: true, suppliers: true } });
      await saveSupplierBid(orgId, qq!.suppliers[0].id, {
        leadTimeDays: 1, prices: qq!.items.map((it) => ({ quotationItemId: it.id, unitPrice: 200 })),
      });
      await chooseWinner(orgId, c, forn.id);
    }
    const oA = await generateFromQuotation(orgId, cotX.id!);
    const oB = await generateFromQuotation(orgId, cotY.id!);
    const pedidosDaReq = await prisma.purchaseOrder.count({
      where: { organizationId: orgId, quotationId: { in: [cotX.id!, cotY.id!] } },
    });
    say(`  pedidos gerados a partir da mesma solicitação: ${pedidosDaReq}`);
    check(
      pedidosDaReq <= 1,
      "uma solicitação não vira dois pedidos de compra",
      `gerou ${pedidosDaReq} (A=${oA.ok} B=${oB.ok})`,
    );
  }

  h("RESULTADO");
  if (!falhas.length) say("  Cadeia de compras íntegra: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    for (const t of ["receiptItem", "receipt", "purchaseOrderItem", "purchaseOrder", "quotationPrice", "quotationSupplier", "quotationItem", "quotation", "purchaseApproval", "purchaseRequisitionItem", "purchaseRequisition", "costCenter", "financialEntry", "stockMovement", "productStock", "product", "supplier", "location", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* tabela sem organizationId */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* ignora */ }
    say("\n[limpeza] dados ZZCOMPRAS removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
