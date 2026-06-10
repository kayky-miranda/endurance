import "server-only";
import { prisma } from "@/lib/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CashflowDay {
  label: string; // dd/mm
  entradas: number;
  saidas: number;
}

export interface DRE {
  receita: number; // receita bruta de vendas
  cmv: number; // custo das mercadorias vendidas
  lucroBruto: number;
  margemBruta: number; // %
  despesas: number; // contas a pagar (operacionais)
  resultado: number; // resultado líquido
}

export interface CashflowReport {
  series: CashflowDay[];
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  dre: DRE;
  hasData: boolean;
}

/**
 * Fluxo de caixa (entradas x saídas realizadas, por dia) + DRE simplificado,
 * unindo as vendas (receita/CMV) e o financeiro (recebido/pago e despesas).
 */
export async function getCashflow(
  org: string,
  days = 30,
  chartDays = 14,
): Promise<CashflowReport> {
  const now = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  // --- Fluxo de caixa realizado (por paidAt) ---
  const paid = await prisma.financialEntry.findMany({
    where: { organizationId: org, status: "pago", paidAt: { gte: start } },
    select: { kind: true, amount: true, paidAt: true },
  });

  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - chartDays + 1);
  chartStart.setHours(0, 0, 0, 0);

  const byDay = new Map<string, { entradas: number; saidas: number }>();
  const series: CashflowDay[] = [];
  for (let i = 0; i < chartDays; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const entry = { entradas: 0, saidas: 0 };
    byDay.set(key, entry);
    series.push({
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      entradas: 0,
      saidas: 0,
    });
  }

  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const e of paid) {
    if (!e.paidAt) continue;
    if (e.kind === "receber") totalEntradas += e.amount;
    else totalSaidas += e.amount;
    const key = e.paidAt.toISOString().slice(0, 10);
    const slot = byDay.get(key);
    if (slot) {
      if (e.kind === "receber") slot.entradas += e.amount;
      else slot.saidas += e.amount;
    }
  }
  // Aplica os acumulados diários à série ordenada.
  for (let i = 0; i < series.length; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    const slot = byDay.get(d.toISOString().slice(0, 10))!;
    series[i].entradas = round2(slot.entradas);
    series[i].saidas = round2(slot.saidas);
  }

  // --- DRE (competência) ---
  const sales = await prisma.sale.findMany({
    where: { organizationId: org, createdAt: { gte: start } },
    select: { total: true, items: true },
  });
  const products = await prisma.product.findMany({
    where: { organizationId: org },
    select: { id: true, cost: true },
  });
  const costById = new Map(products.map((p) => [p.id, p.cost]));

  let receita = 0;
  let cmv = 0;
  for (const s of sales) {
    receita += s.total;
    for (const it of s.items) {
      const c = it.productId ? (costById.get(it.productId) ?? 0) : 0;
      cmv += c * it.quantity;
    }
  }
  receita = round2(receita);
  cmv = round2(cmv);
  const lucroBruto = round2(receita - cmv);
  const margemBruta = receita > 0 ? round2((lucroBruto / receita) * 100) : 0;

  // Despesas operacionais: contas a pagar com vencimento no período.
  const payables = await prisma.financialEntry.findMany({
    where: { organizationId: org, kind: "pagar", dueDate: { gte: start, lte: now } },
    select: { amount: true },
  });
  const despesas = round2(payables.reduce((a, p) => a + p.amount, 0));
  const resultado = round2(lucroBruto - despesas);

  return {
    series,
    totalEntradas: round2(totalEntradas),
    totalSaidas: round2(totalSaidas),
    saldo: round2(totalEntradas - totalSaidas),
    dre: { receita, cmv, lucroBruto, margemBruta, despesas, resultado },
    hasData: paid.length > 0 || sales.length > 0,
  };
}
