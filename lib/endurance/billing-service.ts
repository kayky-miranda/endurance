import "server-only";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { resolveBillingProvider } from "@/lib/endurance/billing-provider";
import { logger } from "@/lib/logger";
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

export type CheckoutResult =
  | { ok: true; redirectUrl: string | null }
  | { ok: false; error: string };

/**
 * Inicia a assinatura de um plano pago via gateway externo (Asaas): cria a
 * cobrança recorrente, guarda as referências do gateway e devolve o link do
 * checkout hospedado para o cliente pagar a 1ª cobrança. A confirmação de
 * pagamento chega depois pelo webhook (que mantém o status sincronizado).
 *
 * O acesso é concedido na hora (status "active") e revogado pelo webhook se a
 * cobrança vencer sem pagamento (PAYMENT_OVERDUE → past_due).
 */
export async function createExternalSubscription(
  org: string,
  rawPlan: string,
  contactEmail: string,
): Promise<CheckoutResult> {
  const plan = planById(rawPlan);
  if (!plan) return { ok: false, error: "Plano inválido." };
  if (plan.contactSales)
    return { ok: false, error: "O plano Enterprise é contratado com vendas." };
  if (!isPaidPlan(plan.id) || plan.priceMonthly == null)
    return { ok: false, error: "Este plano não é cobrado." };

  const provider = resolveBillingProvider();
  if (!provider.external)
    return { ok: false, error: "Gateway de cobrança não configurado." };

  const [organization, fiscal] = await Promise.all([
    prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
    prisma.fiscalConfig.findUnique({
      where: { organizationId: org },
      select: { cnpj: true },
    }),
  ]);
  const cpfCnpj = (fiscal?.cnpj ?? "").replace(/\D/g, "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)
    return {
      ok: false,
      error: "Configure um CPF/CNPJ válido na aba Fiscal antes de assinar.",
    };

  const created = await provider.createSubscription({
    orgId: org,
    planId: plan.id,
    valueMonthly: plan.priceMonthly,
    customer: {
      name: organization?.name ?? "Cliente ENDURANCE",
      email: contactEmail,
      cpfCnpj,
    },
  });
  if (!created.ok || !created.subscriptionId)
    return { ok: false, error: created.error ?? "Falha ao criar a assinatura no gateway." };

  const seats = plan.seats > 0 ? plan.seats : 9999;
  const now = new Date();
  const periodEnd = nextPeriodEnd(now);
  await prisma.subscription.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      plan: plan.id,
      status: "active",
      seats,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      asaasCustomerId: created.customerId ?? null,
      asaasSubscriptionId: created.subscriptionId,
    },
    update: {
      plan: plan.id,
      status: "active",
      seats,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      asaasCustomerId: created.customerId ?? null,
      asaasSubscriptionId: created.subscriptionId,
    },
  });

  return { ok: true, redirectUrl: created.invoiceUrl ?? null };
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

  // Cancela também no gateway para parar as cobranças futuras (o acesso local
  // segue até o fim do ciclo já pago). Best-effort: não trava o cancelamento.
  if (cancel && sub.asaasSubscriptionId) {
    const provider = resolveBillingProvider();
    if (provider.external) {
      const c = await provider.cancelSubscription(sub.asaasSubscriptionId);
      if (!c.ok)
        logger.warn("Falha ao cancelar assinatura no gateway", {
          org,
          error: c.error,
        });
    }
  }

  await prisma.subscription.update({
    where: { organizationId: org },
    data: { cancelAtPeriodEnd: cancel },
  });
  return { ok: true };
}

/** Catálogo de planos exposto para conveniência das telas server-side. */
export { PLAN_CATALOG };
