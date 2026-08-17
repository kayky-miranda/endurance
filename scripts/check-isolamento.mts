/**
 * TESTE DE ISOLAMENTO ENTRE EMPRESAS (multi-tenant) na camada de SERVIÇO.
 *
 * O e2e já cobre "um usuário não abre a URL do espaço de outro". Aqui a
 * pergunta é outra e mais perigosa: se um id vazar (id de produto, de pedido,
 * de documento fiscal), a função de serviço entrega o dado de outra empresa?
 *
 * Toda função de leitura/escrita que recebe um id ANTES do org precisa
 * conferir o dono. Este script tenta acessar recursos da empresa B usando a
 * organização da empresa A.
 *
 * Dados prefixados com ZZISO e removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { getReceivingTarget, receiveOrder } from "../lib/endurance/receiving.ts";
import { getOrderDetail, sendOrder, cancelOrder } from "../lib/endurance/purchase-orders.ts";
import { getRequisitionDetail, updateRequisition, deleteRequisition } from "../lib/endurance/requisitions.ts";
import { getQuotationDetail, chooseWinner } from "../lib/endurance/quotations.ts";
import { decideApproval } from "../lib/endurance/approvals.ts";
import { emitNfce, cancelNfce } from "../lib/endurance/fiscal-service.ts";

const say = (s = "") => console.log(s);
const vazou: string[] = [];
/** Passa quando a empresa A NÃO consegue tocar no recurso da empresa B. */
const barrado = (ok: boolean, desc: string, detalhe = "") => {
  say(`  ${ok ? "barrado " : "VAZOU  "} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!ok) vazou.push(desc + (detalhe ? " :: " + detalhe : ""));
};

const orgs: string[] = [];

async function novaEmpresa(tag: string) {
  const o = await prisma.organization.create({
    data: {
      slug: `zziso-${tag}-${Date.now()}`,
      name: `ZZISO ${tag}`,
      niche: "outro",
      nicheLabel: "Outro",
      locations: { create: { name: "Matriz", code: "MTZ", isDefault: true } },
    },
  });
  orgs.push(o.id);
  const u = await prisma.user.create({
    data: {
      organizationId: o.id,
      email: `zziso.${tag}.${Date.now()}@exemplo.com`,
      name: `ZZISO ${tag}`,
      passwordHash: "x".repeat(60),
      role: "OWNER",
      profile: "administrador",
      permissions: [],
    },
  });
  return { orgId: o.id, userId: u.id };
}

try {
  say("── preparo: duas empresas ─────────────────────────────────");
  const A = await novaEmpresa("a");
  const B = await novaEmpresa("b");
  say(`  A=${A.orgId}  B=${B.orgId}`);

  // ---- recursos que existem só na empresa B --------------------------------
  const prodB = await prisma.product.create({
    data: { organizationId: B.orgId, name: "ZZISO Produto B", price: 50, stock: 100, sku: "ZZB" },
  });
  const fornB = await prisma.supplier.create({
    data: { organizationId: B.orgId, name: "ZZISO Fornecedor B", paymentTermDays: 15 },
  });
  const reqB = await prisma.purchaseRequisition.create({
    data: {
      organizationId: B.orgId, number: "SC-B001", requesterId: B.userId,
      requesterName: "ZZISO B", status: "em_aprovacao", priority: "media",
      estimatedTotal: 1000,
      items: { create: [{ productId: prodB.id, name: prodB.name, quantity: 5, estimatedUnitCost: 200 }] },
    },
  });
  const apvB = await prisma.purchaseApproval.create({
    data: { requisitionId: reqB.id, level: "supervisor", status: "pendente" },
  });
  const cotB = await prisma.quotation.create({
    data: {
      organizationId: B.orgId, number: "COT-B001", status: "aberta",
      items: { create: [{ productId: prodB.id, name: prodB.name, quantity: 5 }] },
      suppliers: { create: [{ supplierId: fornB.id, total: 1000 }] },
    },
  });
  const pedB = await prisma.purchaseOrder.create({
    data: {
      organizationId: B.orgId, supplierId: fornB.id, status: "enviado", total: 1000,
      items: { create: [{ productId: prodB.id, name: prodB.name, quantity: 5, unitCost: 200 }] },
    },
    include: { items: true },
  });
  const vendaB = await prisma.sale.create({
    data: {
      organizationId: B.orgId, subtotal: 50, discount: 0, total: 50, itemsCount: 1,
      token: `zziso-${Date.now()}`,
      items: { create: [{ productId: prodB.id, name: prodB.name, quantity: 1, unitPrice: 50 }] },
      payments: { create: [{ method: "dinheiro", amount: 50 }] },
    },
  });
  const docB = await prisma.fiscalDocument.create({
    data: {
      organizationId: B.orgId, saleId: vendaB.id, modelo: "65", serie: 1, numero: 1,
      chave: "9".repeat(44), status: "autorizada", ambiente: "2", provider: "", valorTotal: 50,
    },
  });

  say("\n── empresa A tentando tocar nos dados da empresa B ─────────");

  const alvo = await getReceivingTarget(A.orgId, pedB.id);
  barrado(alvo === null, "getReceivingTarget não devolve pedido de outra empresa");

  const rec = await receiveOrder(
    A.orgId, pedB.id,
    [{ orderItemId: pedB.items[0].id, qtyReceived: 5, qualityOk: true }],
    { id: A.userId, name: "ZZISO A" }, "invasão",
  );
  barrado(rec.ok === false, "receiveOrder recusa pedido de outra empresa", rec.error ?? "");

  const det = await getOrderDetail(A.orgId, pedB.id);
  barrado(det === null, "getOrderDetail não devolve pedido de outra empresa");

  const env = await sendOrder(A.orgId, pedB.id);
  barrado(env.ok === false, "sendOrder recusa pedido de outra empresa", env.error ?? "");

  const can = await cancelOrder(A.orgId, pedB.id);
  barrado(can.ok === false, "cancelOrder recusa pedido de outra empresa", can.error ?? "");

  const reqDet = await getRequisitionDetail(A.orgId, reqB.id);
  barrado(reqDet === null, "getRequisitionDetail não devolve solicitação de outra empresa");

  const upd = await updateRequisition(A.orgId, reqB.id, {
    items: [{ name: "hack", quantity: 1, estimatedUnit: 1 }], priority: "baixa", note: "",
  } as never);
  barrado(upd.ok === false, "updateRequisition recusa solicitação de outra empresa", upd.error ?? "");

  const del = await deleteRequisition(A.orgId, reqB.id);
  barrado(del.ok === false, "deleteRequisition recusa solicitação de outra empresa", del.error ?? "");

  const apv = await decideApproval(A.orgId, apvB.id, "aprovar" as never, { id: A.userId, name: "ZZISO A" }, "");
  barrado(apv.ok === false, "decideApproval recusa aprovação de outra empresa", apv.error ?? "");

  const cotDet = await getQuotationDetail(A.orgId, cotB.id);
  barrado(cotDet === null, "getQuotationDetail não devolve cotação de outra empresa");

  const win = await chooseWinner(A.orgId, cotB.id, fornB.id);
  barrado(win.ok === false, "chooseWinner recusa cotação de outra empresa", win.error ?? "");

  const emi = await emitNfce(A.orgId, vendaB.id);
  barrado(emi.ok === false, "emitNfce recusa venda de outra empresa", emi.error ?? "");

  const cnc = await cancelNfce(A.orgId, docB.id, "ZZISO tentativa de cancelamento cruzado");
  barrado(cnc.ok === false, "cancelNfce recusa documento de outra empresa", cnc.error ?? "");

  say("\n── conferindo que nada da empresa B mudou ──────────────────");
  const prodDepois = await prisma.product.findUnique({ where: { id: prodB.id } });
  barrado(prodDepois?.stock === 100, "estoque da empresa B intacto", `veio ${prodDepois?.stock}`);
  const pedDepois = await prisma.purchaseOrder.findUnique({ where: { id: pedB.id } });
  barrado(pedDepois?.status === "enviado", "pedido da empresa B intacto", `status=${pedDepois?.status}`);
  const docDepois = await prisma.fiscalDocument.findUnique({ where: { id: docB.id } });
  barrado(docDepois?.status === "autorizada", "documento fiscal da empresa B intacto", `status=${docDepois?.status}`);
  const movs = await prisma.stockMovement.count({ where: { organizationId: B.orgId } });
  barrado(movs === 0, "nenhuma movimentação criada na empresa B", `veio ${movs}`);
  const contas = await prisma.financialEntry.count({ where: { organizationId: B.orgId } });
  barrado(contas === 0, "nenhuma conta a pagar criada na empresa B", `veio ${contas}`);

  say("\n── RESULTADO ──────────────────────────────────────────────");
  if (!vazou.length) say("  Isolamento íntegro: nenhum vazamento entre empresas.");
  else vazou.forEach((v, i) => say(`  ${i + 1}. ${v}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  vazou.push("exceção");
} finally {
  for (const orgId of orgs) {
    for (const t of ["receiptItem", "receipt", "purchaseOrderItem", "purchaseOrder", "quotationPrice", "quotationSupplierItem", "quotationSupplier", "quotationItem", "quotation", "purchaseApproval", "purchaseRequisitionItem", "purchaseRequisition", "fiscalDocument", "salePayment", "saleItem", "sale", "financialEntry", "stockMovement", "productStock", "product", "supplier", "location", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* sem organizationId */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* ignora */ }
  }
  say("\n[limpeza] dados ZZISO removidos");
  await prisma.$disconnect();
  process.exit(vazou.length ? 1 : 0);
}
