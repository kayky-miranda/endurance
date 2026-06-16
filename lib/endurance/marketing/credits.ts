import "server-only";
import { prisma } from "@/lib/db";
import { PLANS, planById, type PlanId } from "./plans";

export interface BalanceInfo {
  plan: PlanId;
  status: string;
  balance: number;
  unlimited: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  extraCreditCost: number;
}

/** Garante que a org tem uma assinatura de marketing; cria trial se não tiver. */
export async function ensureSubscription(orgId: string): Promise<BalanceInfo> {
  const existing = await prisma.marketingSubscription.findUnique({
    where: { organizationId: orgId },
  });
  if (existing) return toBalanceInfo(orgId, existing);

  const trial = PLANS.find((p) => p.id === "trial")!;
  const now = new Date();
  const trialEnd = new Date(now.getTime() + trial.trialDays * 86400_000);
  const sub = await prisma.marketingSubscription.create({
    data: {
      organizationId: orgId,
      plan: "trial",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
      credits: trial.creditsPerMonth,
    },
  });
  await prisma.creditLedger.create({
    data: {
      organizationId: orgId,
      marketingSubId: sub.id,
      amount: trial.creditsPerMonth,
      reason: "trial_grant",
      expiresAt: trialEnd,
    },
  });
  return toBalanceInfo(orgId, sub);
}

export async function getBalance(orgId: string): Promise<BalanceInfo> {
  return ensureSubscription(orgId);
}

/** Debita 1 crédito. Retorna ok=false se saldo insuficiente. */
export async function debitCredits(
  orgId: string,
  amount: number,
  reason: string,
  campaignId?: string,
): Promise<{ ok: boolean; balance: number }> {
  const info = await ensureSubscription(orgId);
  if (!info.unlimited && info.balance < amount) {
    return { ok: false, balance: info.balance };
  }

  const sub = await prisma.marketingSubscription.findUnique({
    where: { organizationId: orgId },
  });
  if (!sub) return { ok: false, balance: 0 };

  await prisma.creditLedger.create({
    data: {
      organizationId: orgId,
      marketingSubId: sub.id,
      campaignId: campaignId ?? null,
      amount: -amount,
      reason,
    },
  });

  const newBalance = info.unlimited ? Infinity : info.balance - amount;
  return { ok: true, balance: info.unlimited ? -1 : newBalance };
}

/** Estorna créditos (usado quando a IA falha após débito). */
export async function refundCredits(
  orgId: string,
  amount: number,
  reason: string,
  campaignId?: string,
): Promise<void> {
  const sub = await prisma.marketingSubscription.findUnique({
    where: { organizationId: orgId },
  });
  if (!sub) return;
  await prisma.creditLedger.create({
    data: {
      organizationId: orgId,
      marketingSubId: sub.id,
      campaignId: campaignId ?? null,
      amount,
      reason,
    },
  });
}

/** Compra créditos extras. */
export async function purchaseExtras(
  orgId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const sub = await prisma.marketingSubscription.findUnique({
    where: { organizationId: orgId },
  });
  if (!sub) return;
  await prisma.creditLedger.create({
    data: {
      organizationId: orgId,
      marketingSubId: sub.id,
      amount,
      reason,
    },
  });
}

/** Troca de plano: zera ledger e recredita o novo plano. */
export async function changePlan(
  orgId: string,
  newPlanId: PlanId,
): Promise<BalanceInfo> {
  const plan = planById(newPlanId);
  if (!plan) throw new Error("Plano inválido.");

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400_000);

  const sub = await prisma.marketingSubscription.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      plan: newPlanId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      credits: plan.creditsPerMonth === -1 ? 9999 : plan.creditsPerMonth,
    },
    update: {
      plan: newPlanId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      credits: plan.creditsPerMonth === -1 ? 9999 : plan.creditsPerMonth,
    },
  });

  // Crédita o novo ciclo
  if (plan.creditsPerMonth !== -1) {
    await prisma.creditLedger.create({
      data: {
        organizationId: orgId,
        marketingSubId: sub.id,
        amount: plan.creditsPerMonth,
        reason: `plan_change_to_${newPlanId}`,
        expiresAt: periodEnd,
      },
    });
  }

  return toBalanceInfo(orgId, sub);
}

// ---------------------------------------------------------------------------

async function toBalanceInfo(
  orgId: string,
  sub: {
    plan: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date;
  },
): Promise<BalanceInfo> {
  const plan = planById(sub.plan as PlanId) ?? planById("trial")!;
  const unlimited = plan.creditsPerMonth === -1;

  // Saldo = SUM(amount) do ledger
  const agg = await prisma.creditLedger.aggregate({
    where: { organizationId: orgId },
    _sum: { amount: true },
  });
  const balance = Math.max(0, agg._sum.amount ?? 0);

  // Verifica se trial expirou
  let status = sub.status;
  if (
    sub.plan === "trial" &&
    sub.trialEndsAt &&
    sub.trialEndsAt < new Date() &&
    balance <= 0
  ) {
    status = "trial_ended";
  }

  return {
    plan: sub.plan as PlanId,
    status,
    balance: unlimited ? -1 : balance,
    unlimited,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    extraCreditCost: plan.extraCreditCost,
  };
}
