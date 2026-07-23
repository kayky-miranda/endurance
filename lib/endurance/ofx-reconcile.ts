import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { parseOfx, type OfxTransaction } from "./ofx";

/**
 * Conciliação bancária por OFX: cruza as transações do extrato com os
 * lançamentos financeiros PENDENTES (a receber = crédito, a pagar = débito).
 *
 * A régua de casamento é conservadora — casa por valor exato e data próxima
 * (±4 dias, para cobrir o intervalo entre vencimento e compensação). Nada é
 * marcado sozinho: o serviço apenas SUGERE; a baixa (marcar como pago +
 * reconciledAt + externalRef = FITID) só acontece quando o usuário confirma.
 */

const DAY = 86400000;
const MATCH_WINDOW_DAYS = 4;

export interface OfxMatchCandidate {
  entryId: string;
  description: string;
  amount: number;
  dueDate: string;
  daysApart: number;
}

export interface OfxLine {
  fitid: string;
  date: string;
  amount: number;
  memo: string;
  kind: "receber" | "pagar";
  /** Já conciliado num import anterior (mesmo FITID já gravado). */
  alreadyReconciled: boolean;
  /** Melhor candidato + alternativas (mesmo valor, janela de data). */
  suggestion: OfxMatchCandidate | null;
  candidates: OfxMatchCandidate[];
}

export interface OfxPreview {
  bankId: string;
  accountId: string;
  total: number;
  matched: number;
  lines: OfxLine[];
}

const fmt = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Monta a prévia de conciliação: para cada transação do extrato, procura os
 * lançamentos pendentes de mesmo valor absoluto e direção compatível, dentro
 * da janela de data. Não grava nada.
 */
export async function buildOfxPreview(
  org: string,
  content: string,
): Promise<OfxPreview> {
  const stmt = parseOfx(content);

  // Lançamentos pendentes da org (poucos, por natureza — são contas em aberto).
  const pending = await prisma.financialEntry.findMany({
    where: { organizationId: org, status: "pendente" },
    select: { id: true, kind: true, description: true, amount: true, dueDate: true },
  });
  const pendingView = pending.map((e) => ({
    ...e,
    value: money(e.amount),
    due: e.dueDate.getTime(),
  }));

  // FITIDs já conciliados antes (idempotência entre reimportações).
  const known = new Set(
    (
      await prisma.financialEntry.findMany({
        where: { organizationId: org, externalRef: { in: stmt.transactions.map((t) => t.fitid) } },
        select: { externalRef: true },
      })
    ).map((r) => r.externalRef),
  );

  const usedEntry = new Set<string>();
  const lines: OfxLine[] = stmt.transactions.map((t: OfxTransaction) => {
    const kind: "receber" | "pagar" = t.amount >= 0 ? "receber" : "pagar";
    const target = Math.abs(t.amount);

    const candidates: OfxMatchCandidate[] = pendingView
      .filter((e) => e.kind === kind && Math.abs(e.value - target) < 0.005)
      .map((e) => ({
        entryId: e.id,
        description: e.description,
        amount: e.value,
        dueDate: fmt(e.dueDate),
        daysApart: Math.round(Math.abs(e.due - t.date.getTime()) / DAY),
      }))
      .filter((c) => c.daysApart <= MATCH_WINDOW_DAYS)
      .sort((a, b) => a.daysApart - b.daysApart);

    // O melhor candidato ainda não reservado por outra linha vira sugestão.
    const suggestion = candidates.find((c) => !usedEntry.has(c.entryId)) ?? null;
    if (suggestion) usedEntry.add(suggestion.entryId);

    return {
      fitid: t.fitid,
      date: fmt(t.date),
      amount: t.amount,
      memo: t.memo,
      kind,
      alreadyReconciled: known.has(t.fitid),
      suggestion,
      candidates,
    };
  });

  return {
    bankId: stmt.bankId,
    accountId: stmt.accountId,
    total: lines.length,
    matched: lines.filter((l) => l.suggestion && !l.alreadyReconciled).length,
    lines,
  };
}

/**
 * Efetiva a conciliação das duplas confirmadas pelo usuário: dá baixa no
 * lançamento (status pago + paidAt) e grava o FITID em externalRef, tudo numa
 * transação. Idempotente: uma linha já conciliada (com externalRef) é pulada.
 */
export async function applyOfxReconciliation(
  org: string,
  pairs: { fitid: string; entryId: string }[],
): Promise<{ ok: boolean; reconciled: number; error?: string }> {
  const clean = pairs.filter((p) => p.fitid && p.entryId).slice(0, 2000);
  if (clean.length === 0) return { ok: true, reconciled: 0 };

  const entries = await prisma.financialEntry.findMany({
    where: {
      organizationId: org,
      id: { in: clean.map((p) => p.entryId) },
      status: "pendente",
    },
    select: { id: true },
  });
  const valid = new Set(entries.map((e) => e.id));

  const now = new Date();
  const ops = clean
    .filter((p) => valid.has(p.entryId))
    .map((p) =>
      prisma.financialEntry.updateMany({
        // Só concilia o que ainda está pendente E sem outra referência externa.
        where: { id: p.entryId, organizationId: org, status: "pendente" },
        data: {
          status: "pago",
          paidAt: now,
          reconciledAt: now,
          externalRef: p.fitid,
        },
      }),
    );
  const results = await prisma.$transaction(ops);
  const reconciled = results.reduce((s, r) => s + r.count, 0);
  return { ok: true, reconciled };
}
