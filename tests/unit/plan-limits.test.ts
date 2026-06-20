import { describe, it, expect, beforeEach, vi } from "vitest";

// `vi.mock` é hoisted — precisamos criar os mocks via `vi.hoisted` pra
// estarem disponíveis na fábrica do mock.
const { mockSubscription, mockUser } = vi.hoisted(() => ({
  mockSubscription: { findUnique: vi.fn() },
  mockUser: { count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { subscription: mockSubscription, user: mockUser },
}));

import {
  resolvePlanContext,
  checkSeatAvailability,
  assertSubscriptionActive,
} from "@/lib/endurance/plan-limits";

beforeEach(() => {
  mockSubscription.findUnique.mockReset();
  mockUser.count.mockReset();
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
    expect(res.error).toMatch(/Starter/);
    expect(res.error).toMatch(/2\/2/);
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
