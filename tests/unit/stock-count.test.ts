import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Conferência de estoque: máquina de estados + regra de ouro (nenhum ajuste
 * durante a contagem; ajuste só na efetivação de uma conferência aprovada,
 * pela divergência, via razão).
 */

const { prisma, applyStockMovement } = vi.hoisted(() => ({
  prisma: {
    stockCount: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
    stockCountItem: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  applyStockMovement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/endurance/money", () => ({ money: (n: number) => Number(n) }));
vi.mock("@/lib/endurance/stock-ledger", () => ({ applyStockMovement }));

import {
  canTransition,
  transition,
  adjustCount,
} from "@/lib/endurance/stock-count";

const ORG = "org1";
const ACTOR = { id: "u1", name: "Ana" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      product: {},
      stockCount: { update: prisma.stockCount.update },
    }),
  );
});

describe("máquina de estados", () => {
  it("permite só as transições válidas", () => {
    expect(canTransition("rascunho", "em_conferencia")).toBe(true);
    expect(canTransition("em_conferencia", "aguardando_aprovacao")).toBe(true);
    expect(canTransition("aguardando_aprovacao", "aprovada")).toBe(true);
    expect(canTransition("aprovada", "ajustada")).toBe(true);
    // inválidas — não pode pular etapas nem mexer no que já foi ajustado
    expect(canTransition("rascunho", "aprovada")).toBe(false);
    expect(canTransition("em_conferencia", "ajustada")).toBe(false);
    expect(canTransition("ajustada", "cancelada")).toBe(false);
    expect(canTransition("cancelada", "em_conferencia")).toBe(false);
  });

  it("bloqueia transição inválida no serviço", async () => {
    prisma.stockCount.findFirst.mockResolvedValue({ id: "c1", status: "rascunho" });
    const res = await transition(ORG, "c1", "ajustada", ACTOR);
    expect(res.ok).toBe(false);
    expect(prisma.stockCount.update).not.toHaveBeenCalled();
  });

  it("aprovação grava quem aprovou e quando", async () => {
    prisma.stockCount.findFirst.mockResolvedValue({
      id: "c1",
      status: "aguardando_aprovacao",
    });
    const res = await transition(ORG, "c1", "aprovada", ACTOR);
    expect(res.ok).toBe(true);
    const data = prisma.stockCount.update.mock.calls[0][0].data;
    expect(data.status).toBe("aprovada");
    expect(data.approvedById).toBe("u1");
    expect(data.approvedAt).toBeInstanceOf(Date);
  });
});

describe("adjustCount — efetivação", () => {
  it("recusa se a conferência não está aprovada", async () => {
    prisma.stockCount.findFirst.mockResolvedValue({
      id: "c1",
      status: "aguardando_aprovacao",
      items: [],
    });
    const res = await adjustCount(ORG, "c1", ACTOR);
    expect(res.ok).toBe(false);
    expect(applyStockMovement).not.toHaveBeenCalled();
  });

  it("ajusta só os itens divergentes, pela divergência, via razão inventario", async () => {
    prisma.stockCount.findFirst.mockResolvedValue({
      id: "c1",
      number: "CONF-2026-0001",
      status: "aprovada",
      items: [
        { productId: "p1", systemQty: 10, countedQty: 8, note: "" }, // -2 (perda)
        { productId: "p2", systemQty: 5, countedQty: 5, note: "" }, //  0 (sem ajuste)
        { productId: "p3", systemQty: 0, countedQty: 3, note: "sobra" }, // +3
        { productId: "p4", systemQty: 4, countedQty: null, note: "" }, // não contado
      ],
    });
    const res = await adjustCount(ORG, "c1", ACTOR);
    expect(res.ok).toBe(true);
    expect(res.adjusted).toBe(2); // só p1 e p3

    const calls = applyStockMovement.mock.calls.map((c) => c[1]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      productId: "p1",
      delta: -2,
      reason: "inventario",
      refType: "stock_count",
      allowNegative: true,
    });
    expect(calls[1]).toMatchObject({ productId: "p3", delta: 3, reason: "inventario" });
    // status vira "ajustada"
    const updData = prisma.stockCount.update.mock.calls.at(-1)?.[0].data;
    expect(updData.status).toBe("ajustada");
  });
});
