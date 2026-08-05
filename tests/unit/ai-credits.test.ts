import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSubscription, mockOrg } = vi.hoisted(() => ({
  mockSubscription: { findUnique: vi.fn(), updateMany: vi.fn() },
  mockOrg: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { subscription: mockSubscription, organization: mockOrg },
}));

import {
  getAiBalance,
  consumeAiCredit,
  refundAiCredit,
  AI_FEATURE_COST,
  AI_FEATURES,
} from "@/lib/endurance/ai-credits";

const DAY = 86_400_000;

/** Assinatura no plano informado, com consumo e início de janela dados. */
function sub(plan: string, used: number, sinceDaysAgo = 1) {
  mockSubscription.findUnique.mockResolvedValue({
    plan,
    status: "active",
    seats: 10,
    trialEndsAt: null,
    legacyFullAccess: false,
    aiCreditsUsed: used,
    aiCreditsSince: new Date(Date.now() - sinceDaysAgo * DAY),
  });
}

beforeEach(() => {
  mockSubscription.findUnique.mockReset();
  mockSubscription.updateMany.mockReset();
  mockSubscription.updateMany.mockResolvedValue({ count: 1 });
  mockOrg.findUnique.mockReset();
  mockOrg.findUnique.mockResolvedValue({ createdAt: new Date("2030-01-01") });
});

describe("custos", () => {
  it("todo recurso tem custo positivo", () => {
    for (const f of AI_FEATURES) expect(AI_FEATURE_COST[f]).toBeGreaterThan(0);
  });

  it("o recurso mais pesado custa mais que os simples", () => {
    // A análise clínica gera ~1.200 tokens estruturados; um resumo, ~100.
    expect(AI_FEATURE_COST.clinical_analysis).toBeGreaterThan(
      AI_FEATURE_COST.clinical_summary,
    );
    expect(AI_FEATURE_COST.assistant).toBeGreaterThan(AI_FEATURE_COST.crosssell);
  });
});

describe("getAiBalance", () => {
  it("desconta o consumido do teto do plano", async () => {
    sub("professional", 40); // Professional = 150
    const b = await getAiBalance("org1");
    expect(b.included).toBe(150);
    expect(b.used).toBe(40);
    expect(b.remaining).toBe(110);
    expect(b.unlimited).toBe(false);
  });

  it("Enterprise não tem teto", async () => {
    sub("enterprise", 5000);
    const b = await getAiBalance("org1");
    expect(b.unlimited).toBe(true);
    expect(b.remaining).toBe(Number.POSITIVE_INFINITY);
  });

  it("janela vencida zera o consumo", async () => {
    sub("professional", 150, 31); // estourou o ciclo de 30 dias
    const b = await getAiBalance("org1");
    expect(b.windowExpired).toBe(true);
    expect(b.used).toBe(0);
    expect(b.remaining).toBe(150);
  });

  it("janela vigente NÃO é tratada como vencida", async () => {
    // Assinatura nova com zero consumo não pode parecer ciclo vencido, senão a
    // janela seria renovada a cada primeiro uso e o teto nunca valeria.
    sub("professional", 0, 2);
    const b = await getAiBalance("org1");
    expect(b.windowExpired).toBe(false);
  });
});

describe("consumeAiCredit", () => {
  it("debita o custo do recurso", async () => {
    sub("business", 10); // Business = 800
    const r = await consumeAiCredit("org1", "clinical_analysis");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(800 - 10 - 3);
    expect(mockSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aiCreditsUsed: { increment: 3 } } }),
    );
  });

  it("bloqueia sem saldo e explica o caminho", async () => {
    sub("professional", 149); // sobra 1, análise custa 3
    const r = await consumeAiCredit("org1", "clinical_analysis");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/upgrade/i);
    expect(mockSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("saldo exato ainda passa", async () => {
    sub("professional", 147); // sobram exatamente 3
    expect((await consumeAiCredit("org1", "clinical_analysis")).ok).toBe(true);
  });

  it("Enterprise não debita nem consulta limite", async () => {
    sub("enterprise", 99_999);
    const r = await consumeAiCredit("org1", "clinical_analysis");
    expect(r.ok).toBe(true);
    expect(mockSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("ciclo vencido REINICIA o contador em vez de incrementar", async () => {
    sub("professional", 150, 31);
    const r = await consumeAiCredit("org1", "clinical_summary");
    expect(r.ok).toBe(true);
    const arg = mockSubscription.updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({
      aiCreditsUsed: 1,
      aiCreditsSince: expect.any(Date),
    });
  });
});

describe("refundAiCredit", () => {
  it("devolve exatamente o custo do recurso", async () => {
    await refundAiCredit("org1", "clinical_analysis");
    const arg = mockSubscription.updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ aiCreditsUsed: { decrement: 3 } });
  });

  it("não deixa o contador ficar negativo", async () => {
    await refundAiCredit("org1", "clinical_analysis");
    const arg = mockSubscription.updateMany.mock.calls[0][0];
    expect(arg.where.aiCreditsUsed).toEqual({ gte: 3 });
  });
});
