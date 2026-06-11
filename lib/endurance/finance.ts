import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { money } from "./money";

const round2 = (n: number) => Math.round(n * 100) / 100;

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

// Prazo de compensação por forma de pagamento (dias). Crédito vira recebível.
const SETTLE_DAYS: Record<string, number> = {
  dinheiro: 0,
  pix: 0,
  debito: 1,
  credito: 30,
};

export interface SaleReceivableInput {
  organizationId: string;
  saleId: string;
  saleCode: string;
  when: Date;
  payments: { method: string; amount: number }[];
}

/**
 * Gera os recebíveis de uma venda. Dinheiro/Pix/Débito entram como já recebidos;
 * Crédito vira conta a receber com vencimento em 30 dias (compensação do cartão).
 * Aceita um client de transação para rodar atomicamente com a venda.
 */
export async function createReceivablesForSale(
  i: SaleReceivableInput,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const data = i.payments
    .filter((p) => p.amount > 0)
    .map((p) => {
      const days = SETTLE_DAYS[p.method] ?? 0;
      const due = new Date(i.when);
      due.setDate(due.getDate() + days);
      const settled = days === 0;
      return {
        organizationId: i.organizationId,
        kind: "receber",
        description: `Venda ${i.saleCode} · ${PAY_LABEL[p.method] ?? p.method}`,
        category: "Vendas",
        amount: round2(p.amount),
        status: settled ? "pago" : "pendente",
        method: p.method,
        saleId: i.saleId,
        dueDate: due,
        paidAt: settled ? i.when : null,
      };
    });
  if (data.length > 0) await db.financialEntry.createMany({ data });
}

export interface FinanceRow {
  id: string;
  description: string;
  category: string;
  amount: number;
  status: "pendente" | "pago";
  dueDate: string;
  overdue: boolean;
  method: string;
}

export interface FinanceOverview {
  kpis: {
    aReceber: number;
    aPagar: number;
    saldoPrevisto: number;
    vencidos: number;
    recebidoMes: number;
    pagoMes: number;
  };
  receber: FinanceRow[];
  pagar: FinanceRow[];
}

function toRow(e: {
  id: string;
  description: string;
  category: string;
  amount: number;
  status: string;
  dueDate: Date;
  method: string;
}): FinanceRow {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id: e.id,
    description: e.description,
    category: e.category,
    amount: e.amount,
    status: e.status as "pendente" | "pago",
    method: e.method,
    dueDate: e.dueDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    overdue: e.status === "pendente" && e.dueDate < today,
  };
}

export async function getFinanceOverview(org: string): Promise<FinanceOverview> {
  const entries = await prisma.financialEntry.findMany({
    where: { organizationId: org },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  let aReceber = 0;
  let aPagar = 0;
  let vencidos = 0;
  let recebidoMes = 0;
  let pagoMes = 0;
  for (const e of entries) {
    const pend = e.status === "pendente";
    const amount = money(e.amount);
    if (e.kind === "receber") {
      if (pend) aReceber += amount;
      else if (e.paidAt && e.paidAt >= startMonth) recebidoMes += amount;
    } else {
      if (pend) aPagar += amount;
      else if (e.paidAt && e.paidAt >= startMonth) pagoMes += amount;
    }
    if (pend && e.dueDate < today) vencidos++;
  }

  const receber = entries
    .filter((e) => e.kind === "receber")
    .map((e) => toRow({ ...e, amount: money(e.amount) }))
    .slice(0, 40);
  const pagar = entries
    .filter((e) => e.kind === "pagar")
    .map((e) => toRow({ ...e, amount: money(e.amount) }))
    .slice(0, 40);

  return {
    kpis: {
      aReceber: round2(aReceber),
      aPagar: round2(aPagar),
      saldoPrevisto: round2(aReceber - aPagar),
      vencidos,
      recebidoMes: round2(recebidoMes),
      pagoMes: round2(pagoMes),
    },
    receber,
    pagar,
  };
}

export async function markEntryPaid(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = await prisma.financialEntry.findUnique({ where: { id } });
  if (!e || e.organizationId !== org)
    return { ok: false, error: "Lançamento não encontrado." };
  if (e.status === "pago") return { ok: true };
  await prisma.financialEntry.update({
    where: { id },
    data: { status: "pago", paidAt: new Date() },
  });
  return { ok: true };
}

export interface NewEntryInput {
  kind: "receber" | "pagar";
  description: string;
  category: string;
  amount: number;
  dueDate: string; // yyyy-mm-dd
}

export async function createEntry(
  org: string,
  input: NewEntryInput,
): Promise<{ ok: boolean; error?: string }> {
  const description = (input.description ?? "").trim();
  if (!description) return { ok: false, error: "Informe a descrição." };
  const amount = round2(Number(input.amount) || 0);
  if (amount <= 0) return { ok: false, error: "Informe um valor válido." };
  const kind = input.kind === "pagar" ? "pagar" : "receber";
  const due = input.dueDate ? new Date(input.dueDate + "T12:00:00") : new Date();
  if (Number.isNaN(due.getTime()))
    return { ok: false, error: "Data de vencimento inválida." };
  await prisma.financialEntry.create({
    data: {
      organizationId: org,
      kind,
      description: description.slice(0, 120),
      category: (input.category ?? "").trim().slice(0, 40) || "Outros",
      amount,
      status: "pendente",
      dueDate: due,
    },
  });
  return { ok: true };
}
