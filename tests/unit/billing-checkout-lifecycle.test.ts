import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Ciclo de vida do checkout externo (Asaas):
 * - iniciar o checkout NÃO muda plano/status (só grava pendingPlan);
 * - o plano só é promovido pelo webhook, após pagamento confirmado;
 * - reentrega de webhook não reaplica plano nem duplica fatura (idempotência);
 * - desistência (overdue/cancel com pendingPlan) não altera o plano atual.
 */

const { prisma, provider } = vi.hoisted(() => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
    fiscalConfig: { findUnique: vi.fn() },
  },
  provider: {
    id: "asaas" as const,
    external: true,
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/endurance/billing-provider", () => ({
  resolveBillingProvider: () => provider,
}));

import {
  createExternalSubscription,
  applyGatewayEvent,
} from "@/lib/endurance/billing-service";

const ORG = "org-1";

function subRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-row-1",
    organizationId: ORG,
    plan: "starter",
    status: "trialing",
    seats: 2,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    pendingPlan: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.invoice.count.mockResolvedValue(0);
  provider.cancelSubscription.mockResolvedValue({ ok: true });
});

describe("createExternalSubscription", () => {
  beforeEach(() => {
    prisma.organization.findUnique.mockResolvedValue({ name: "Mercado X" });
    prisma.fiscalConfig.findUnique.mockResolvedValue({ cnpj: "11222333000181" });
    prisma.subscription.findUnique.mockResolvedValue(null);
    provider.createSubscription.mockResolvedValue({
      ok: true,
      subscriptionId: "sub_asaas_1",
      customerId: "cus_1",
      invoiceUrl: "https://asaas.com/i/abc",
    });
  });

  it("NÃO altera plano nem status — só grava a intenção (pendingPlan)", async () => {
    const res = await createExternalSubscription(ORG, "professional", "a@b.c");
    expect(res).toEqual({ ok: true, redirectUrl: "https://asaas.com/i/abc" });

    const upsert = prisma.subscription.upsert.mock.calls[0][0];
    // update de linha existente: nada de plan/status/seats — apenas intenção.
    expect(upsert.update).toEqual({
      pendingPlan: "professional",
      asaasCustomerId: "cus_1",
      asaasSubscriptionId: "sub_asaas_1",
    });
    // create (linha nova): materializa o DEFAULT (starter/trialing), nunca o pago.
    expect(upsert.create.plan).toBe("starter");
    expect(upsert.create.status).toBe("trialing");
    expect(upsert.create.pendingPlan).toBe("professional");
  });

  it("cancela a assinatura anterior no gateway ao iniciar um novo checkout", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ asaasSubscriptionId: "sub_asaas_old" }),
    );
    await createExternalSubscription(ORG, "business", "a@b.c");
    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_asaas_old");
  });

  it("exige CPF/CNPJ configurado", async () => {
    prisma.fiscalConfig.findUnique.mockResolvedValue(null);
    const res = await createExternalSubscription(ORG, "professional", "a@b.c");
    expect(res.ok).toBe(false);
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe("applyGatewayEvent — confirmação de pagamento", () => {
  it("promove o pendingPlan e emite a fatura na 1ª confirmação", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ pendingPlan: "professional", asaasSubscriptionId: "sub_asaas_1" }),
    );
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    const res = await applyGatewayEvent(ORG, "active");

    expect(res.activatedPlan).toBe("professional");
    const upd = prisma.subscription.updateMany.mock.calls[0][0];
    // Guarda de idempotência no where: só aplica se o pendingPlan ainda é este.
    expect(upd.where).toEqual({ organizationId: ORG, pendingPlan: "professional" });
    expect(upd.data.plan).toBe("professional");
    expect(upd.data.status).toBe("active");
    expect(upd.data.pendingPlan).toBeNull();
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it("reentrega do webhook não duplica fatura nem reaplica plano", async () => {
    // 2º evento: o pendingPlan já foi consumido pela 1ª entrega.
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ plan: "professional", status: "active", pendingPlan: null }),
    );
    const res = await applyGatewayEvent(ORG, "active");
    expect(res.activatedPlan).toBeNull();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    // Cai no caminho de renovação (status + ciclo), determinístico.
    expect(prisma.subscription.update).toHaveBeenCalled();
  });

  it("corrida entre webhooks: updateMany 0 linhas → não emite fatura", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ pendingPlan: "professional" }),
    );
    prisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    const res = await applyGatewayEvent(ORG, "active");
    expect(res.activatedPlan).toBeNull();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});

describe("applyGatewayEvent — desistência e inadimplência", () => {
  it("overdue com checkout pendente: plano atual fica intacto", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({
        plan: "starter",
        status: "trialing",
        pendingPlan: "professional",
        asaasSubscriptionId: "sub_asaas_1",
      }),
    );

    const res = await applyGatewayEvent(ORG, "past_due");

    expect(res.becamePastDue).toBe(false);
    // Limpa a intenção e a referência órfã; NÃO toca em plan/status.
    const upd = prisma.subscription.update.mock.calls[0][0];
    expect(upd.data).toEqual({ pendingPlan: null, asaasSubscriptionId: null });
    // Cancela a assinatura abandonada no gateway.
    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_asaas_1");
  });

  it("overdue de assinatura ativa real: marca past_due, inicia a carência e sinaliza dunning", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ plan: "professional", status: "active" }),
    );
    const res = await applyGatewayEvent(ORG, "past_due");
    expect(res.becamePastDue).toBe(true);

    const upd = prisma.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe("past_due");
    // O relógio da carência começa AQUI — é o que evita travar a operação de
    // quem estava pagando por um cartão que o banco recusou.
    expect(upd.data.pastDueSince).toBeInstanceOf(Date);
  });

  it("segunda notificação da MESMA pendência não reinicia a carência", async () => {
    // Sem esta guarda o gateway poderia empurrar a carência para sempre a cada
    // reenvio de webhook, e ela nunca terminaria.
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ plan: "professional", status: "past_due" }),
    );
    const res = await applyGatewayEvent(ORG, "past_due");
    expect(res.becamePastDue).toBe(false);

    const upd = prisma.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe("past_due");
    expect(upd.data.pastDueSince).toBeUndefined();
  });

  it("pagamento confirmado encerra a carência", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ plan: "professional", status: "past_due", pendingPlan: null }),
    );
    await applyGatewayEvent(ORG, "active");
    const upd = prisma.subscription.update.mock.calls[0][0];
    expect(upd.data.status).toBe("active");
    expect(upd.data.pastDueSince).toBeNull();
  });

  it("cancelamento real: status canceled + cancelAtPeriodEnd", async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      subRow({ plan: "professional", status: "active" }),
    );
    const res = await applyGatewayEvent(ORG, "canceled");
    expect(res.becamePastDue).toBe(false);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { organizationId: ORG },
      data: { status: "canceled", cancelAtPeriodEnd: true },
    });
  });

  it("org sem assinatura: evento é ignorado (rows 0)", async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    const res = await applyGatewayEvent(ORG, "active");
    expect(res).toEqual({ rows: 0, activatedPlan: null, becamePastDue: false });
  });
});
