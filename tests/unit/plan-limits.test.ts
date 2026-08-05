import { describe, it, expect, beforeEach, vi } from "vitest";

// `vi.mock` é hoisted — precisamos criar os mocks via `vi.hoisted` pra
// estarem disponíveis na fábrica do mock.
const { mockSubscription, mockUser, mockOrg } = vi.hoisted(() => ({
  mockSubscription: { findUnique: vi.fn() },
  mockUser: { count: vi.fn() },
  mockOrg: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: mockSubscription,
    user: mockUser,
    organization: mockOrg,
  },
}));

import {
  resolvePlanContext,
  checkSeatAvailability,
  assertSubscriptionActive,
  checkPlanFeature,
} from "@/lib/endurance/plan-limits";

beforeEach(() => {
  mockSubscription.findUnique.mockReset();
  mockUser.count.mockReset();
  mockOrg.findUnique.mockReset();
  // Por padrão a org é NOVA (posterior à vigência das capacidades) — assim os
  // testes existentes medem a regra atual, não o direito adquirido.
  mockOrg.findUnique.mockResolvedValue({ createdAt: new Date("2030-01-01") });
});

describe("resolvePlanContext", () => {
  it("sem subscription assume starter trialing", async () => {
    mockSubscription.findUnique.mockResolvedValue(null);
    const ctx = await resolvePlanContext("org1");
    expect(ctx.plan).toBe("starter");
    expect(ctx.status).toBe("trialing");
    expect(ctx.seats).toBe(2);
    expect(ctx.trialExpired).toBe(false);
  });

  it("trial com trialEndsAt no passado marca trialExpired=true", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "trialing",
      seats: 10,
      trialEndsAt: new Date(Date.now() - 1000),
    });
    const ctx = await resolvePlanContext("org1");
    expect(ctx.trialExpired).toBe(true);
  });

  it("active não marca trialExpired mesmo com trialEndsAt antigo", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "active",
      seats: 10,
      trialEndsAt: new Date(Date.now() - 86_400_000),
    });
    const ctx = await resolvePlanContext("org1");
    expect(ctx.trialExpired).toBe(false);
  });
});

describe("checkSeatAvailability", () => {
  it("plano Enterprise (seats=0) sempre libera", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "enterprise",
      status: "active",
      seats: 0,
      trialEndsAt: null,
    });
    const res = await checkSeatAvailability("org1");
    expect(res.ok).toBe(true);
    expect(res.limit).toBe(0);
    // Quando ilimitado, nem conta usuários.
    expect(mockUser.count).not.toHaveBeenCalled();
  });

  it("plano com vaga disponível libera", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "active",
      seats: 10,
      trialEndsAt: null,
    });
    mockUser.count.mockResolvedValue(7);
    const res = await checkSeatAvailability("org1");
    expect(res).toMatchObject({ ok: true, used: 7, limit: 10 });
  });

  it("plano cheio bloqueia com mensagem clara", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "starter",
      status: "trialing",
      seats: 2,
      trialEndsAt: null,
    });
    mockUser.count.mockResolvedValue(2);
    const res = await checkSeatAvailability("org1");
    expect(res.ok).toBe(false);
    expect(res.used).toBe(2);
    expect(res.limit).toBe(2);
    // Asserta o COMPORTAMENTO (uso/limite e caminho de saída), não o rótulo
    // comercial do plano — que muda com a estratégia de preço.
    expect(res.error).toMatch(/2\/2/);
    expect(res.error).toMatch(/upgrade/i);
  });

  it("conta só usuários ativos (exclui blocked/deleted)", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "active",
      seats: 10,
      trialEndsAt: null,
    });
    mockUser.count.mockResolvedValue(3);
    await checkSeatAvailability("org1");
    const call = mockUser.count.mock.calls[0][0];
    expect(call.where.status).toEqual({ notIn: ["blocked", "deleted"] });
  });
});

describe("assertSubscriptionActive", () => {
  it("active passa", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "active",
      seats: 10,
      trialEndsAt: null,
    });
    const res = await assertSubscriptionActive("org1");
    expect(res.ok).toBe(true);
  });

  it("past_due bloqueia", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "past_due",
      seats: 10,
      trialEndsAt: null,
    });
    const res = await assertSubscriptionActive("org1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Pagamento/i);
  });

  it("canceled bloqueia", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "canceled",
      seats: 10,
      trialEndsAt: null,
    });
    const res = await assertSubscriptionActive("org1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cancelada/i);
  });

  it("trial expirado bloqueia mesmo com status=trialing", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "starter",
      status: "trialing",
      seats: 2,
      trialEndsAt: new Date(Date.now() - 86_400_000),
    });
    const res = await assertSubscriptionActive("org1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/teste encerrado/i);
  });

  it("trial vigente passa", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "starter",
      status: "trialing",
      seats: 2,
      trialEndsAt: new Date(Date.now() + 86_400_000),
    });
    const res = await assertSubscriptionActive("org1");
    expect(res.ok).toBe(true);
  });
});

describe("checkPlanFeature", () => {
  it("plano sem a capacidade bloqueia e aponta o plano necessário", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "professional",
      status: "active",
      seats: 3,
      trialEndsAt: null,
      legacyFullAccess: false,
    });
    const v = await checkPlanFeature("org1", "api.access");
    expect(v.ok).toBe(false);
    expect(v.requiredPlan).toBe("business");
    expect(v.error).toMatch(/Business/);
  });

  it("plano com a capacidade libera", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "business",
      status: "active",
      seats: 10,
      trialEndsAt: null,
      legacyFullAccess: false,
    });
    const v = await checkPlanFeature("org1", "api.access");
    expect(v.ok).toBe(true);
  });

  it("DIREITO ADQUIRIDO pela flag: contrato antigo mantém tudo", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      plan: "starter",
      status: "active",
      seats: 2,
      trialEndsAt: null,
      legacyFullAccess: true,
    });
    for (const f of ["api.access", "multi.company", "white.label"] as const) {
      expect((await checkPlanFeature("org1", f)).ok, f).toBe(true);
    }
  });

  it("DIREITO ADQUIRIDO pela idade: org anterior à vigência mantém tudo", async () => {
    // Cliente que nunca materializou assinatura (sem linha) mas já usava o
    // sistema — não pode perder acesso por causa da mudança de estratégia.
    mockSubscription.findUnique.mockResolvedValue(null);
    mockOrg.findUnique.mockResolvedValue({ createdAt: new Date("2026-01-01") });
    expect((await checkPlanFeature("org1", "multi.company")).ok).toBe(true);
  });

  it("org NOVA sem assinatura NÃO recebe direito adquirido", async () => {
    mockSubscription.findUnique.mockResolvedValue(null);
    mockOrg.findUnique.mockResolvedValue({ createdAt: new Date("2030-06-01") });
    expect((await checkPlanFeature("org1", "api.access")).ok).toBe(false);
  });
});
