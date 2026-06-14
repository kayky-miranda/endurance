import "server-only";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import {
  PLAN_CATALOG,
  planById,
  isPaidPlan,
  nextPeriodEnd,
  asPlanId,
  type PlanId,
  type SubStatus,
  type BillingView,
  type InvoiceView,
} from "@/lib/endurance/billing";

/** Estado padrão de quem nunca mexeu na assinatura: Starter em teste. */
function defaultBilling(): BillingView {
  return {
    plan: "starter",
    status: "trialing",
    seats: planById("starter")!.seats,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    virtual: true,
  };
}

/**
 * Carrega a assinatura (e faturas) de um espaço para exibição. Não escreve no
 * banco: se ainda não existir linha, devolve um default virtual (Starter/teste).
 * A linha real é materializada na primeira troca de plano.
 */
export async function loadBilling(
  org: string,
): Promise<{ billing: BillingView; invoices: InvoiceView[] }> {
  const [sub, invoices] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: org } }),
    prisma.invoice.findMany({
      where: { organizationId: org },
      orderBy: { issuedAt: "desc" },
      take: 24,
    }),
  ]);

  const billing: BillingView = sub
    ? {
        plan: asPlanId(sub.plan),
        status: sub.status as SubStatus,
        seats: sub.seats,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
        virtual: false,
      }
    : defaultBilling();

  return {
    billing,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      plan: asPlanId(i.plan),
      amount: money(i.amount),
      status: i.status,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      issuedAt: i.issuedAt.toISOString(),
    })),
  };
}

/** Gera um número de fatura humano: AAAA-NNNN sequencial por ano/organização. */
async function nextInvoiceNumber(org: string): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.invoice.count({
    where: { organizationId: org, issuedAt: { gte: start } },
  });
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

export type ChangePlanResult =
  | { ok: true; plan: PlanId; invoiced: boolean }
  | { ok: false; error: string };

/**
 * Troca o plano do espaço (upsert da assinatura) e, para planos pagos, emite
 * uma fatura interna do novo ciclo. Imediato — sem provedor de pagamento.
 */
export async function changePlan(
  org: string,
  rawPlan: string,
): Promise<ChangePlanResult> {
  const plan = planById(rawPlan);
  if (!plan) return { ok: false, error: "Plano inválido." };
  if (plan.contactSales)
    return {
      ok: false,
      error: "O plano Enterprise é contratado com o time de vendas.",
    };

  const seats = plan.seats > 0 ? plan.seats : 9999;
  const now = new Date();
  const periodEnd = nextPeriodEnd(now);

  const sub = await prisma.subscription.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      plan: plan.id,
      status: "active",
      seats,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    update: {
      plan: plan.id,
      status: "active",
      seats,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    },
  });

  let invoiced = false;
  if (isPaidPlan(plan.id)) {
    await prisma.invoice.create({
      data: {
        organizationId: org,
        subscriptionId: sub.id,
        number: await nextInvoiceNumber(org),
        plan: plan.id,
        amount: plan.priceMonthly ?? 0,
        status: "paga",
        periodStart: now,
        periodEnd,
        paidAt: now,
      },
    });
    invoiced = true;
  }

  return { ok: true, plan: plan.id, invoiced };
}

/**
 * Agenda (ou desfaz) o cancelamento ao fim do ciclo. Mantém o acesso até o fim
 * do período já pago — comportamento padrão de assinaturas SaaS.
 */
export async function setCancelAtPeriodEnd(
  org: string,
  cancel: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: org },
  });
  if (!sub)
    return { ok: false, error: "Nenhuma assinatura ativa para cancelar." };
  await prisma.subscription.update({
    where: { organizationId: org },
    data: { cancelAtPeriodEnd: cancel },
  });
  return { ok: true };
}

/** Catálogo de planos exposto para conveniência das telas server-side. */
export { PLAN_CATALOG };
