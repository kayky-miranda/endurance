import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Multi-local: o razão escritura o saldo DO LOCAL (ProductStock) e o TOTAL
 * consolidado (Product.stock) na mesma operação. A saída é validada contra o
 * local — não se vende de uma loja usando o estoque de outra.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    product: { findFirst: vi.fn(), updateMany: vi.fn() },
    productStock: {
      updateMany: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    stockMovement: { create: vi.fn() },
    location: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/endurance/pagination", () => ({
  PAGE_SIZE: 20,
  clampPage: (p: number) => p ?? 1,
  pageMeta: () => ({}),
}));

import {
  applyStockMovement,
  transferStock,
  InsufficientStockError,
} from "@/lib/endurance/stock-ledger";

const ORG = "org1";
const LOJA_A = "locA";
const LOJA_B = "locB";
const tx = prisma as unknown as Parameters<typeof applyStockMovement>[0];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.product.findFirst.mockResolvedValue({ name: "Arroz 5kg" });
  prisma.product.updateMany.mockResolvedValue({ count: 1 });
  prisma.productStock.findUnique.mockResolvedValue({ qty: 0 });
  prisma.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
    typeof fn === "function" ? fn(prisma) : fn,
  );
});

describe("applyStockMovement — escrituração por local", () => {
  it("entrada credita o LOCAL e soma no total consolidado", async () => {
    prisma.productStock.findUnique.mockResolvedValue({ qty: 15 });
    await applyStockMovement(tx, {
      organizationId: ORG,
      productId: "p1",
      delta: 5,
      reason: "recebimento",
      locationId: LOJA_A,
    });

    // saldo do local via upsert (+5)
    const upsert = prisma.productStock.upsert.mock.calls[0][0];
    expect(upsert.where.productId_locationId.locationId).toBe(LOJA_A);
    expect(upsert.update.qty).toEqual({ increment: 5 });
    // total consolidado também sobe
    expect(prisma.product.updateMany.mock.calls[0][0].data.stock).toEqual({
      increment: 5,
    });
    // o razão guarda o local e o saldo DO LOCAL
    const mov = prisma.stockMovement.create.mock.calls[0][0].data;
    expect(mov.locationId).toBe(LOJA_A);
    expect(mov.balanceAfter).toBe(15);
    expect(mov.balanceBefore).toBe(10);
  });

  it("saída é validada contra o saldo DO LOCAL (baixa condicional)", async () => {
    prisma.productStock.updateMany.mockResolvedValue({ count: 1 });
    prisma.productStock.findUnique.mockResolvedValue({ qty: 3 });
    await applyStockMovement(tx, {
      organizationId: ORG,
      productId: "p1",
      delta: -2,
      reason: "venda",
      locationId: LOJA_A,
    });
    const w = prisma.productStock.updateMany.mock.calls[0][0].where;
    expect(w.locationId).toBe(LOJA_A);
    expect(w.qty).toEqual({ gte: 2 }); // só baixa se houver saldo lá
  });

  it("sem saldo NO LOCAL, recusa mesmo havendo estoque em outra loja", async () => {
    // updateMany não encontra linha com qty suficiente naquele local
    prisma.productStock.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      applyStockMovement(tx, {
        organizationId: ORG,
        productId: "p1",
        delta: -2,
        reason: "venda",
        locationId: LOJA_B,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    // nada foi lançado no total nem no razão
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("sem locationId, resolve o local padrão da organização", async () => {
    prisma.location.findFirst.mockResolvedValue({ id: "locPadrao" });
    prisma.productStock.findUnique.mockResolvedValue({ qty: 1 });
    await applyStockMovement(tx, {
      organizationId: ORG,
      productId: "p1",
      delta: 1,
      reason: "ajuste_entrada",
    });
    expect(prisma.stockMovement.create.mock.calls[0][0].data.locationId).toBe(
      "locPadrao",
    );
  });

  it("cria a Matriz quando a organização ainda não tem nenhum local", async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    prisma.location.create.mockResolvedValue({ id: "locNova" });
    prisma.productStock.findUnique.mockResolvedValue({ qty: 1 });
    await applyStockMovement(tx, {
      organizationId: ORG,
      productId: "p1",
      delta: 1,
      reason: "saldo_inicial",
    });
    expect(prisma.location.create.mock.calls[0][0].data.isDefault).toBe(true);
    expect(prisma.stockMovement.create.mock.calls[0][0].data.locationId).toBe(
      "locNova",
    );
  });
});

describe("transferStock — entre locais", () => {
  beforeEach(() => {
    prisma.location.findMany.mockResolvedValue([
      { id: LOJA_A, name: "Matriz" },
      { id: LOJA_B, name: "Filial" },
    ]);
    prisma.productStock.updateMany.mockResolvedValue({ count: 1 });
    prisma.productStock.findUnique.mockResolvedValue({ qty: 7 });
  });

  it("gera saída na origem e entrada no destino (total da rede inalterado)", async () => {
    const res = await transferStock(ORG, {
      productId: "p1",
      fromLocationId: LOJA_A,
      toLocationId: LOJA_B,
      quantity: 4,
      actor: { id: "u1", name: "Ana" },
    });
    expect(res.ok).toBe(true);

    const movs = prisma.stockMovement.create.mock.calls.map((c) => c[0].data);
    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({
      locationId: LOJA_A,
      quantity: -4,
      reason: "transferencia",
    });
    expect(movs[1]).toMatchObject({
      locationId: LOJA_B,
      quantity: 4,
      reason: "transferencia",
    });
    // o total consolidado sobe e desce a mesma quantidade → soma zero
    const deltas = prisma.product.updateMany.mock.calls.map(
      (c) => c[0].data.stock.increment,
    );
    expect(deltas.reduce((a: number, b: number) => a + b, 0)).toBe(0);
  });

  it("recusa transferência para o mesmo local", async () => {
    const res = await transferStock(ORG, {
      productId: "p1",
      fromLocationId: LOJA_A,
      toLocationId: LOJA_A,
      quantity: 1,
      actor: { id: "u1", name: "Ana" },
    });
    expect(res.ok).toBe(false);
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("recusa quantidade zero ou negativa", async () => {
    for (const q of [0, -3]) {
      const res = await transferStock(ORG, {
        productId: "p1",
        fromLocationId: LOJA_A,
        toLocationId: LOJA_B,
        quantity: q,
        actor: { id: "u1", name: "Ana" },
      });
      expect(res.ok).toBe(false);
    }
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("sem saldo na origem, nada é transferido", async () => {
    prisma.productStock.updateMany.mockResolvedValue({ count: 0 });
    const res = await transferStock(ORG, {
      productId: "p1",
      fromLocationId: LOJA_A,
      toLocationId: LOJA_B,
      quantity: 99,
      actor: { id: "u1", name: "Ana" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("origem");
  });
});
