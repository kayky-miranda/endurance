import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

/**
 * Conciliação PIX: cruza as cobranças (`PixCharge`) com as vendas (`Sale`) e os
 * recebíveis (`FinancialEntry` method="pix"). Cada cobrança vira uma linha com
 * um estado de conciliação. O caso feliz (cobrança paga ↔ recebível de igual
 * valor) é marcado no fechamento da venda (`reconciledAt`); aqui materializamos
 * a visão e sinalizamos o que precisa de atenção.
 */

export type ReconStatus =
  | "conciliado" // pago e batido com o recebível da venda
  | "divergente" // pago e vinculado, mas valor diverge / recebível ausente
  | "pago_sem_venda" // pago sem venda associada (cliente pagou, caixa não fechou)
  | "pendente" // aguardando pagamento
  | "expirado"
  | "cancelado";

export interface ReconRow {
  id: string;
  txid: string;
  amount: number;
  status: ReconStatus;
  saleCode: string | null;
  receivableAmount: number | null;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}

export interface ReconOverview {
  rows: ReconRow[];
  meta: PageMeta;
  kpis: {
    recebidoPix: number;
    conciliados: number;
    divergencias: number;
    pendentes: number;
    pagoSemVenda: number;
  };
}

const saleCodeOf = (saleId: string) => `#${saleId.slice(-6).toUpperCase()}`;

export function classify(
  status: string,
  saleId: string | null,
  amount: number,
  receivable: number | null,
): ReconStatus {
  if (status === "pago") {
    if (!saleId) return "pago_sem_venda";
    if (receivable == null) return "divergente";
    return Math.abs(amount - receivable) <= 0.01 ? "conciliado" : "divergente";
  }
  if (status === "expirado") return "expirado";
  if (status === "cancelado") return "cancelado";
  return "pendente";
}

export async function getReconciliationOverview(
  org: string,
  rawPage = 1,
): Promise<ReconOverview> {
  const [total, pagoAgg, conciliados, pendentes, pagoSemVenda] =
    await Promise.all([
      prisma.pixCharge.count({ where: { organizationId: org } }),
      prisma.pixCharge.aggregate({
        where: { organizationId: org, status: "pago" },
        _sum: { amount: true },
      }),
      prisma.pixCharge.count({
        where: { organizationId: org, status: "pago", NOT: { reconciledAt: null } },
      }),
      prisma.pixCharge.count({
        where: { organizationId: org, status: "pendente" },
      }),
      prisma.pixCharge.count({
        where: { organizationId: org, status: "pago", saleId: null },
      }),
    ]);

  const page = clampPage(rawPage, total);
  const charges = await prisma.pixCharge.findMany({
    where: { organizationId: org },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Recebíveis PIX das vendas exibidas (para conferir valor da cobrança × venda).
  const saleIds = charges
    .map((c) => c.saleId)
    .filter((x): x is string => Boolean(x));
  const receivables = saleIds.length
    ? await prisma.financialEntry.findMany({
        where: { organizationId: org, method: "pix", saleId: { in: saleIds } },
        select: { saleId: true, amount: true },
      })
    : [];
  const recBySale = new Map(
    receivables.map((r) => [r.saleId as string, money(r.amount)]),
  );

  const rows: ReconRow[] = charges.map((c) => {
    const amount = money(c.amount);
    const receivable = c.saleId ? recBySale.get(c.saleId) ?? null : null;
    return {
      id: c.id,
      txid: c.txid,
      amount,
      status: classify(c.status, c.saleId, amount, receivable),
      saleCode: c.saleId ? saleCodeOf(c.saleId) : null,
      receivableAmount: receivable,
      provider: c.provider || "simulado",
      createdAt: c.createdAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      paidAt: c.paidAt
        ? c.paidAt.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    };
  });

  // Divergências exigem o join cobrança×recebível; conta na página exibida
  // (o caso normal é zero — o fechamento da venda já bate cobrança e recebível).
  const divergencias = rows.filter((r) => r.status === "divergente").length;

  return {
    rows,
    meta: pageMeta(page, total),
    kpis: {
      recebidoPix: money(pagoAgg._sum.amount),
      conciliados,
      divergencias,
      pendentes,
      pagoSemVenda,
    },
  };
}

/**
 * Reconhece manualmente uma cobrança (ex.: PIX pago sem venda que o operador
 * tratou à parte). Apenas marca `reconciledAt` — não cria venda nem recebível.
 */
export async function markReconciled(
  org: string,
  chargeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await prisma.pixCharge.findUnique({ where: { id: chargeId } });
  if (!c || c.organizationId !== org)
    return { ok: false, error: "Cobrança não encontrada." };
  if (c.status !== "pago")
    return { ok: false, error: "Só cobranças pagas podem ser conciliadas." };
  if (c.reconciledAt) return { ok: true };
  await prisma.pixCharge.update({
    where: { id: chargeId },
    data: { reconciledAt: new Date() },
  });
  return { ok: true };
}
