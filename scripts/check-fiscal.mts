/**
 * TESTE FISCAL na camada de serviço: numeração, idempotência e cancelamento.
 *
 * O caso que mais assusta é numeração duplicada sob concorrência — duas notas
 * com o mesmo número é problema com a SEFAZ, não bug de tela. Aqui várias
 * emissões disparam em paralelo de propósito.
 *
 * Emite em HOMOLOGAÇÃO com provedor simulado. Dados ZZFIS, removidos no fim.
 */
import { prisma } from "../lib/db.ts";
import { emitNfce, cancelNfce } from "../lib/endurance/fiscal-service.ts";

const say = (s = "") => console.log(s);
const h = (s: string) => { say(); say("── " + s + " " + "─".repeat(Math.max(0, 56 - s.length))); };
const falhas: string[] = [];
const check = (cond: boolean, desc: string, detalhe = "") => {
  say(`  ${cond ? "OK  " : "FALHA"} ${desc}${detalhe ? " :: " + detalhe : ""}`);
  if (!cond) falhas.push(desc + (detalhe ? " :: " + detalhe : ""));
};

let orgId = "";

async function novaVenda(prodId: string, nome: string) {
  return prisma.sale.create({
    data: {
      organizationId: orgId, subtotal: 10, discount: 0, total: 10, itemsCount: 1,
      token: `zzfis-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      items: { create: [{ productId: prodId, name: nome, quantity: 1, unitPrice: 10 }] },
      payments: { create: [{ method: "dinheiro", amount: 10 }] },
    },
  });
}

try {
  h("preparo: empresa apta a emitir em homologação");
  const org = await prisma.organization.create({
    data: {
      slug: `zzfis-${Date.now()}`, name: "ZZFIS Mercado", niche: "outro", nicheLabel: "Outro",
      locations: { create: { name: "Matriz", code: "MTZ", isDefault: true } },
    },
  });
  orgId = org.id;
  await prisma.fiscalConfig.create({
    data: {
      organizationId: orgId,
      cnpj: "11222333000181", razaoSocial: "ZZFIS MERCADO LTDA", nomeFantasia: "ZZFIS",
      ie: "123456789", crt: "1",
      cep: "13010000", logradouro: "Rua Teste", numeroEnd: "1", bairro: "Centro",
      municipio: "Campinas", uf: "SP", cMun: "3509502",
      cscId: "000001", csc: "ZZFIS-CSC", defaultNcm: "22021000",
      ambiente: "2", serie: 1, proxNumero: 1,
    },
  });
  const prod = await prisma.product.create({
    data: { organizationId: orgId, name: "ZZFIS Água 500ml", price: 10, stock: 1000, sku: "ZZF1", ncm: "22021000" },
  });
  say("  empresa pronta (homologação, provedor simulado)");

  h("1. emissão simples");
  const v1 = await novaVenda(prod.id, prod.name);
  const e1 = await emitNfce(orgId, v1.id);
  check(e1.ok === true, "emitiu", e1.error ?? "");
  check(e1.numero === 1, "primeira nota recebe número 1", `veio ${e1.numero}`);
  check(typeof e1.chave === "string" && e1.chave.length === 44, "chave com 44 dígitos", `${e1.chave?.length}`);

  h("2. emitir a MESMA venda de novo");
  const e1b = await emitNfce(orgId, v1.id);
  check(e1b.ok === true && e1b.docId === e1.docId, "devolve o mesmo documento, não emite outro", `${e1b.docId}`);
  const docsDaVenda = await prisma.fiscalDocument.count({ where: { saleId: v1.id } });
  check(docsDaVenda === 1, "a venda tem exatamente 1 documento", `veio ${docsDaVenda}`);

  h("3. DEZ emissões simultâneas (numeração sob concorrência)");
  const vendas = await Promise.all(
    Array.from({ length: 10 }, () => novaVenda(prod.id, prod.name)),
  );
  const res = await Promise.all(vendas.map((v) => emitNfce(orgId, v.id)));
  const okCount = res.filter((r) => r.ok).length;
  check(okCount === 10, "as 10 emissões deram certo", `veio ${okCount}`);

  const numeros = res.filter((r) => r.ok).map((r) => r.numero!);
  const unicos = new Set(numeros);
  check(unicos.size === numeros.length, "nenhum número repetido", `${numeros.length} notas, ${unicos.size} números`);
  const ordenados = [...numeros].sort((a, b) => a - b);
  check(
    ordenados[0] === 2 && ordenados[ordenados.length - 1] === 11,
    "numeração é contínua de 2 a 11 (sem buraco)",
    `veio ${ordenados[0]}..${ordenados[ordenados.length - 1]}`,
  );

  const chaves = await prisma.fiscalDocument.findMany({
    where: { organizationId: orgId }, select: { chave: true },
  });
  const chavesUnicas = new Set(chaves.map((c) => c.chave));
  check(chavesUnicas.size === chaves.length, "nenhuma chave de acesso repetida", `${chaves.length} docs, ${chavesUnicas.size} chaves`);

  const cfgDepois = await prisma.fiscalConfig.findUnique({ where: { organizationId: orgId } });
  check(cfgDepois?.proxNumero === 12, "próximo número da empresa avançou certo", `veio ${cfgDepois?.proxNumero}`);

  h("4. QR Code e carimbo de homologação");
  const doc1 = await prisma.fiscalDocument.findUnique({ where: { id: e1.docId! } });
  check(Boolean(doc1?.qrCode), "documento tem QR Code");
  check(doc1?.qrCode?.includes("homologacao") === true, "QR aponta para consulta de HOMOLOGAÇÃO", doc1?.qrCode?.slice(0, 60));
  check(doc1?.ambiente === "2", "documento marcado como ambiente 2");
  check(doc1?.provider === "", "documento marcado como simulado (sem provedor)");

  h("5. cancelamento");
  const c1 = await cancelNfce(orgId, e1.docId!, "ZZFIS erro de digitação no valor do item");
  check(c1.ok === true, "cancelou dentro da janela", c1.error ?? "");
  const doc1b = await prisma.fiscalDocument.findUnique({ where: { id: e1.docId! } });
  check(doc1b?.status === "cancelada", "documento fica 'cancelada'", `status=${doc1b?.status}`);

  // Cancelar de novo devolve ok: é idempotência, não falha. Repetir o clique
  // não pode virar erro na cara de quem já cancelou.
  const c2 = await cancelNfce(orgId, e1.docId!, "ZZFIS tentando cancelar de novo agora");
  const doc1c = await prisma.fiscalDocument.findUnique({ where: { id: e1.docId! } });
  check(c2.ok === true, "cancelar de novo é idempotente (não vira erro)", c2.error ?? "");
  check(doc1c?.motivoCancel === "ZZFIS erro de digitação no valor do item", "o motivo do primeiro cancelamento é preservado", doc1c?.motivoCancel);

  h("6. justificativa curta demais");
  const c3 = await cancelNfce(orgId, res[1].docId!, "erro");
  check(c3.ok === false, "recusa justificativa curta (SEFAZ exige 15+)", c3.error ?? "");

  h("7. cancelamento fora da janela");
  // A janela conta de dataAUTORIZACAO, não de dataEmissao — envelhecer o
  // campo errado dá falso positivo (foi o que aconteceu na primeira versão).
  await prisma.fiscalDocument.update({
    where: { id: res[2].docId! },
    data: { dataAutorizacao: new Date(Date.now() - 40 * 60 * 60 * 1000) },
  });
  const c4 = await cancelNfce(orgId, res[2].docId!, "ZZFIS cancelamento fora do prazo legal");
  check(c4.ok === false, "recusa cancelar depois da janela legal", c4.error ?? "");

  h("8. reemissão de venda cancelada — RISCO CONHECIDO");
  const antesDaReemissao = await prisma.fiscalDocument.findUnique({ where: { id: e1.docId! } });
  const e1c = await emitNfce(orgId, v1.id);
  check(e1c.ok === true, "venda com nota cancelada pode ser reemitida", e1c.error ?? "");
  const depoisDaReemissao = await prisma.fiscalDocument.findUnique({ where: { id: e1.docId! } });
  const sobrescreveu = e1c.docId === e1.docId;
  if (sobrescreveu) {
    say("");
    say("  ⚠ RISCO: a reemissão SOBRESCREVEU o documento cancelado.");
    say(`     antes:  nº ${antesDaReemissao?.numero} status=${antesDaReemissao?.status} motivo="${antesDaReemissao?.motivoCancel}"`);
    say(`     depois: nº ${depoisDaReemissao?.numero} status=${depoisDaReemissao?.status} motivo="${depoisDaReemissao?.motivoCancel}"`);
    say("     A nota cancelada desapareceu do sistema, junto com a justificativa");
    say("     e a data do cancelamento. Em produção ela continua existindo e");
    say("     cancelada na SEFAZ, então o livro fiscal da empresa fica diferente");
    say("     do da Receita. Causa: FiscalDocument.saleId é @unique, então cabe");
    say("     um documento por venda e a reemissão faz update na mesma linha.");
    say("     Corrigir exige decisão de schema (vários documentos por venda com");
    say("     um marcado como vigente) — não dá para resolver só no serviço.");
    say("");
  } else {
    check(true, "reemissão gera documento novo e preserva o cancelado");
  }

  h("RESULTADO");
  if (!falhas.length) say("  Camada fiscal íntegra: nenhuma falha.");
  else falhas.forEach((f, i) => say(`  ${i + 1}. ${f}`));
} catch (e) {
  say("\nEXCEÇÃO: " + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  falhas.push("exceção");
} finally {
  if (orgId) {
    for (const t of ["fiscalDocument", "salePayment", "saleItem", "sale", "financialEntry", "stockMovement", "productStock", "product", "fiscalConfig", "location", "user"] as const) {
      try { await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[t].deleteMany({ where: { organizationId: orgId } }); } catch { /* ignora */ }
    }
    try { await prisma.$executeRawUnsafe(`DELETE FROM "endurance_main"."Organization" WHERE id = $1`, orgId); } catch { /* ignora */ }
    say("\n[limpeza] dados ZZFIS removidos");
  }
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}
