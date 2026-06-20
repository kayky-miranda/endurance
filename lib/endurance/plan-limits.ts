import "server-only";
import { prisma } from "@/lib/db";
import { PLAN_CATALOG, type PlanId } from "@/lib/endurance/billing";

/**
 * Enforcement em runtime dos limites de cada plano. A UI esconde o botão de
 * "convidar usuário" quando o limite é atingido — esta camada é o gate real.
 *
 * Resolve o plano da organização a partir da Subscription (se faltar, assume
 * "starter"). `seats=0` no catálogo significa ilimitado (Enterprise).
 */

export interface PlanContext {
  plan: PlanId;
  status: "trialing" | "active" | "past_due" | "canceled";
  seats: number; // 0 = ilimitado
  trialEndsAt: Date | null;
  trialExpired: boolean;
}

export async function resolvePlanContext(orgId: string): Promise<PlanContext> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { plan: true, status: true, seats: true, trialEndsAt: true },
  });
  if (!sub) {
    return {
      plan: "starter",
      status: "trialing",
      seats: 2,
      trialEndsAt: null,
      trialExpired: false,
    };
  }
  const trialExpired =
    sub.status === "trialing" &&
    !!sub.trialEndsAt &&
    sub.trialEndsAt.getTime() < Date.now();
  return {
    plan: sub.plan as PlanId,
    status: sub.status as PlanContext["status"],
    seats: sub.seats,
    trialEndsAt: sub.trialEndsAt,
    trialExpired,
  };
}

export interface SeatVerdict {
  ok: boolean;
  used: number;
  limit: number; // 0 = ilimitado
  error?: string;
}

/**
 * Verifica se há vaga (seat) disponível pra mais um usuário. Conta apenas
 * usuários ativos (excluindo `status='blocked'` e `'deleted'`).
 */
export async function checkSeatAvailability(orgId: string): Promise<SeatVerdict> {
  const ctx = await resolvePlanContext(orgId);
  if (ctx.seats === 0) return { ok: true, used: 0, limit: 0 };

  const used = await prisma.user.count({
    where: {
      organizationId: orgId,
      status: { notIn: ["blocked", "deleted"] },
    },
  });

  if (used >= ctx.seats) {
    const planDef = PLAN_CATALOG.find((p) => p.id === ctx.plan);
    return {
      ok: false,
      used,
      limit: ctx.seats,
      error: `Limite do plano ${planDef?.name ?? ctx.plan} atingido (${used}/${ctx.seats} usuários). Faça upgrade ou remova um usuário.`,
    };
  }
  return { ok: true, used, limit: ctx.seats };
}

/**
 * Bloqueia mutações sensíveis se a assinatura está em past_due ou canceled.
 * Leitura e operações de manutenção continuam liberadas.
 */
export interface SubscriptionVerdict {
  ok: boolean;
  status: PlanContext["status"];
  error?: string;
}
export async function assertSubscriptionActive(
  orgId: string,
): Promise<SubscriptionVerdict> {
  const ctx = await resolvePlanContext(orgId);
  if (ctx.status === "canceled")
    return { ok: false, status: ctx.status, error: "Assinatura cancelada. Reative o plano para continuar." };
  if (ctx.status === "past_due")
    return { ok: false, status: ctx.status, error: "Pagamento pendente. Regularize para liberar esta ação." };
  if (ctx.trialExpired)
    return { ok: false, status: ctx.status, error: "Período de teste encerrado. Escolha um plano para continuar." };
  return { ok: true, status: ctx.status };
}
