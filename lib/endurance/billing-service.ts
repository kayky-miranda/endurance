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
    pendingPlan: null,
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
        pendingPlan: sub.pendingPlan ? asPlanId(sub.pendingPlan) : null,
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
 * checkout hospedado para o cliente pagar a 1ª cobrança.
 *
 * IMPORTANTE: aqui só registramos a INTENÇÃO (`pendingPlan`) — o plano e o
 * status do espaço NÃO mudam neste momento. Quem promove o plano é o webhook
 * (`applyGatewayEvent`), somente após o Asaas confirmar o pagamento
 * (PAYMENT_CONFIRMED/RECEIVED). Se o usuário fechar o checkout sem pagar,
 * nada muda na conta dele.
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

  const [organization, fiscal, existing] = await Promise.all([
    prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
    prisma.fiscalConfig.findUnique({
      where: { organizationId: org },
      select: { cnpj: true },
    }),
    prisma.subscription.findUnique({ where: { organizationId: org } }),
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

  // Um checkout novo substitui a assinatura anterior no gateway (se houver):
  // cancela a antiga para não deixar cobrança órfã/duplicada rodando no Asaas.
  if (
    existing?.asaasSubscriptionId &&
    existing.asaasSubscriptionId !== created.subscriptionId
  ) {
    const c = await provider.cancelSubscription(existing.asaasSubscriptionId);
    if (!c.ok)
      logger.warn("Falha ao cancelar assinatura anterior no gateway", {
        org,
        subscriptionId: existing.asaasSubscriptionId,
        error: c.error,
      });
  }

  // Materializa/atualiza a linha SEM tocar em plan/status/seats/período — só a
  // intenção (pendingPlan) e as referências do gateway.
  const now = new Date();
  await prisma.subscription.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      // Espaço que nunca teve assinatura entra com o default (Starter em
      // teste) — o plano pago só vale depois do pagamento confirmado.
      plan: "starter",
      status: "trialing",
      seats: planById("starter")!.seats,
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd(now),
      cancelAtPeriodEnd: false,
      pendingPlan: plan.id,
      asaasCustomerId: created.customerId ?? null,
      asaasSubscriptionId: created.subscriptionId,
    },
    update: {
      pendingPlan: plan.id,
      asaasCustomerId: created.customerId ?? null,
      asaasSubscriptionId: created.subscriptionId,
    },
  });

  return { ok: true, redirectUrl: created.invoiceUrl ?? null };
}

export type GatewayEventResult = {
  /** Quantas assinaturas foram alteradas (0 = evento sem correspondência). */
  rows: number;
  /** O evento promoveu um pendingPlan a plano efetivo. */
  activatedPlan: PlanId | null;
  /** O evento marcou uma assinatura ativa como inadimplente (para dunning). */
  becamePastDue: boolean;
};

/**
 * Aplica um evento do gateway (chamado pelo webhook, após validar o token).
 * É o ÚNICO ponto que promove plano por pagamento — o checkout nunca o faz.
 *
 * Idempotente por construção: o pendingPlan é limpo na ativação, então um
 * webhook reentregue (o Asaas reenvia até receber 200, e CONFIRMED/RECEIVED
 * chegam em dupla para a mesma cobrança) não reaplica o plano nem emite
 * fatura duplicada — cai no caminho de renovação, que é determinístico.
 */
export async function applyGatewayEvent(
  org: string,
  status: SubStatus,
): Promise<GatewayEventResult> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: org },
  });
  if (!sub) return { rows: 0, activatedPlan: null, becamePastDue: false };

  const now = new Date();

  if (status === "active") {
    const pending = sub.pendingPlan ? planById(sub.pendingPlan) : undefined;

    if (pending) {
      // 1º pagamento do checkout confirmado → promove o plano pendente.
      const seats = pending.seats > 0 ? pending.seats : 9999;
      const periodEnd = nextPeriodEnd(now);
      const applied = await prisma.subscription.updateMany({
        // Guarda de idempotência: só aplica se o pendingPlan ainda é este.
        where: { organizationId: org, pendingPlan: sub.pendingPlan },
        data: {
          plan: pending.id,
          status: "active",
          seats,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          trialEndsAt: null,
          pendingPlan: null,
        },
      });
      if (applied.count > 0) {
        await prisma.invoice.create({
          data: {
            organizationId: org,
            subscriptionId: sub.id,
            number: await nextInvoiceNumber(org),
            plan: pending.id,
            amount: pending.priceMonthly ?? 0,
            status: "paga",
            periodStart: now,
            periodEnd,
            paidAt: now,
          },
        });
        return { rows: 1, activatedPlan: pending.id, becamePastDue: false };
      }
      // Outro webhook aplicou primeiro — segue como renovação (abaixo).
    }

    // Renovação (ou reentrega do evento): confirma o status e avança o ciclo.
    await prisma.subscription.update({
      where: { organizationId: org },
      data: {
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd(now),
      },
    });
    return { rows: 1, activatedPlan: null, becamePastDue: false };
  }

  // past_due/canceled com checkout pendente = o usuário desistiu ou a 1ª
  // cobrança venceu sem pagamento. O plano atual fica intacto — só limpamos a
  // intenção e cancelamos a assinatura órfã no gateway (best-effort).
  if (sub.pendingPlan) {
    if (sub.asaasSubscriptionId) {
      const provider = resolveBillingProvider();
      if (provider.external) {
        const c = await provider.cancelSubscription(sub.asaasSubscriptionId);
        if (!c.ok)
          logger.warn("Falha ao cancelar checkout abandonado no gateway", {
            org,
            error: c.error,
          });
      }
    }
    await prisma.subscription.update({
      where: { organizationId: org },
      data: { pendingPlan: null, asaasSubscriptionId: null },
    });
    return { rows: 1, activatedPlan: null, becamePastDue: false };
  }

  // Assinatura já ativa que atrasou/cancelou de verdade.
  const wasActive = sub.status === "active";
  await prisma.subscription.update({
    where: { organizationId: org },
    data:
      status === "canceled"
        ? { status, cancelAtPeriodEnd: true }
        : { status },
  });
  return {
    rows: 1,
    activatedPlan: null,
    becamePastDue: status === "past_due" && wasActive,
  };
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
