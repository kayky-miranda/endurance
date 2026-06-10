import "server-only";
import { prisma } from "@/lib/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CashBreakdown {
  opening: number;
  cashSales: number; // vendas em dinheiro vinculadas à sessão
  suprimentos: number;
  sangrias: number;
  expected: number; // dinheiro esperado na gaveta
  salesTotal: number; // faturamento total da sessão (todas as formas)
  salesCount: number;
}

export interface OpenSessionView {
  id: string;
  openedBy: string;
  openedAt: string;
  openingAmount: number;
  breakdown: CashBreakdown;
  movements: {
    id: string;
    type: "suprimento" | "sangria";
    amount: number;
    reason: string;
    quando: string;
  }[];
}

export interface ClosedSessionRow {
  id: string;
  operator: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
}

export interface OtherOpenSession {
  id: string;
  operator: string;
  openedAt: string;
  expected: number;
}

export interface CaixaOverview {
  open: OpenSessionView | null;
  others: OtherOpenSession[]; // caixas de outros operadores (visível p/ gestores)
  history: ClosedSessionRow[];
}

/**
 * Caixa aberto de um operador específico (multi-caixa: cada operador tem o seu).
 * Sem userId, retorna qualquer caixa aberto da org (compat. com chamadas legadas).
 */
export async function getOpenSession(org: string, userId?: string) {
  return prisma.cashSession.findFirst({
    where: {
      organizationId: org,
      status: "aberto",
      ...(userId ? { userId } : {}),
    },
    orderBy: { openedAt: "desc" },
  });
}

/** Calcula o esperado em dinheiro e os totais de uma sessão. */
async function computeBreakdown(
  sessionId: string,
  openingAmount: number,
): Promise<CashBreakdown> {
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
  });
  const suprimentos = round2(
    movements.filter((m) => m.type === "suprimento").reduce((a, m) => a + m.amount, 0),
  );
  const sangrias = round2(
    movements.filter((m) => m.type === "sangria").reduce((a, m) => a + m.amount, 0),
  );

  const sales = await prisma.sale.findMany({
    where: { cashSessionId: sessionId },
    include: { payments: true },
  });
  let cashSales = 0;
  let salesTotal = 0;
  for (const s of sales) {
    salesTotal += s.total;
    for (const p of s.payments) {
      if (p.method === "dinheiro") cashSales += p.amount;
    }
  }
  cashSales = round2(cashSales);
  salesTotal = round2(salesTotal);

  const expected = round2(openingAmount + cashSales + suprimentos - sangrias);
  return {
    opening: round2(openingAmount),
    cashSales,
    suprimentos,
    sangrias,
    expected,
    salesTotal,
    salesCount: sales.length,
  };
}

export async function getCaixaOverview(
  org: string,
  userId: string,
  role: string = "MEMBER",
): Promise<CaixaOverview> {
  const isManager = role === "OWNER" || role === "ADMIN";

  // Mapa de nomes de operadores da org (para exibir quem abriu cada caixa).
  const users = await prisma.user.findMany({
    where: { organizationId: org },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const open = await getOpenSession(org, userId);
  let openView: OpenSessionView | null = null;
  if (open) {
    const breakdown = await computeBreakdown(open.id, open.openingAmount);
    const movements = await prisma.cashMovement.findMany({
      where: { sessionId: open.id },
      orderBy: { createdAt: "desc" },
    });
    openView = {
      id: open.id,
      openedBy: open.userId ? (nameById.get(open.userId) ?? "—") : "—",
      openedAt: open.openedAt.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      openingAmount: open.openingAmount,
      breakdown,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type as "suprimento" | "sangria",
        amount: m.amount,
        reason: m.reason,
        quando: m.createdAt.toLocaleString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    };
  }

  // Caixas de outros operadores ainda abertos (visível apenas para gestores).
  const others: OtherOpenSession[] = [];
  if (isManager) {
    const otherOpen = await prisma.cashSession.findMany({
      where: {
        organizationId: org,
        status: "aberto",
        userId: { not: userId },
      },
      orderBy: { openedAt: "desc" },
    });
    for (const o of otherOpen) {
      const b = await computeBreakdown(o.id, o.openingAmount);
      others.push({
        id: o.id,
        operator: o.userId ? (nameById.get(o.userId) ?? "—") : "—",
        openedAt: o.openedAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        expected: b.expected,
      });
    }
  }

  const closed = await prisma.cashSession.findMany({
    where: { organizationId: org, status: "fechado" },
    orderBy: { closedAt: "desc" },
    take: 15,
  });
  const history: ClosedSessionRow[] = closed.map((s) => ({
    id: s.id,
    operator: s.userId ? (nameById.get(s.userId) ?? "—") : "—",
    openedAt: s.openedAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    closedAt: (s.closedAt ?? s.openedAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    openingAmount: s.openingAmount,
    expectedAmount: s.expectedAmount ?? 0,
    countedAmount: s.countedAmount ?? 0,
    difference: s.difference ?? 0,
  }));

  return { open: openView, others, history };
}

export async function openCash(
  org: string,
  userId: string,
  openingAmount: number,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getOpenSession(org, userId);
  if (existing)
    return { ok: false, error: "Você já tem um caixa aberto." };
  const amount = Math.max(0, round2(Number(openingAmount) || 0));
  await prisma.cashSession.create({
    data: { organizationId: org, userId, openingAmount: amount, status: "aberto" },
  });
  return { ok: true };
}

export async function addMovement(
  org: string,
  userId: string,
  type: "suprimento" | "sangria",
  amount: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const open = await getOpenSession(org, userId);
  if (!open) return { ok: false, error: "Você não tem caixa aberto." };
  const value = round2(Number(amount) || 0);
  if (value <= 0) return { ok: false, error: "Informe um valor maior que zero." };
  if (type !== "suprimento" && type !== "sangria")
    return { ok: false, error: "Tipo inválido." };
  if (type === "sangria") {
    const b = await computeBreakdown(open.id, open.openingAmount);
    if (value > b.expected)
      return {
        ok: false,
        error: "Sangria maior que o dinheiro disponível em caixa.",
      };
  }
  await prisma.cashMovement.create({
    data: {
      sessionId: open.id,
      type,
      amount: value,
      reason: (reason ?? "").trim().slice(0, 120),
      userId,
    },
  });
  return { ok: true };
}

export async function closeCash(
  org: string,
  userId: string,
  countedAmount: number,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const open = await getOpenSession(org, userId);
  if (!open) return { ok: false, error: "Você não tem caixa aberto." };
  const breakdown = await computeBreakdown(open.id, open.openingAmount);
  const counted = round2(Number(countedAmount) || 0);
  const difference = round2(counted - breakdown.expected);
  await prisma.cashSession.update({
    where: { id: open.id },
    data: {
      status: "fechado",
      countedAmount: counted,
      expectedAmount: breakdown.expected,
      difference,
      note: (note ?? "").trim().slice(0, 200),
      closedAt: new Date(),
    },
  });
  return { ok: true };
}
