import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Alerta de reposição. Regra: o estoque mínimo definido pelo lojista tem
 * PRECEDÊNCIA sobre a previsão automática — ele conhece sazonalidade e prazo
 * de fornecedor melhor que a média de venda.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    product: { findMany: vi.fn() },
    saleItem: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { getStockAlerts } from "@/lib/endurance/stock-alerts";

const ORG = "org1";
const prod = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "p1",
  name: "Arroz 5kg",
  stock: 100,
  minStock: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.saleItem.findMany.mockResolvedValue([]); // sem histórico de venda
});

describe("getStockAlerts — estoque mínimo por produto", () => {
  it("estoque zerado é sempre rompido", async () => {
    prisma.product.findMany.mockResolvedValue([prod({ stock: 0 })]);
    const [a] = await getStockAlerts(ORG);
    expect(a.level).toBe("rompido");
  });

  it("sem mínimo configurado, saldo alto e sem venda não gera alerta", async () => {
    prisma.product.findMany.mockResolvedValue([prod({ stock: 100 })]);
    expect(await getStockAlerts(ORG)).toHaveLength(0);
  });

  it("saldo no ponto de reposição do produto dispara alerta", async () => {
    prisma.product.findMany.mockResolvedValue([prod({ stock: 30, minStock: 30 })]);
    const [a] = await getStockAlerts(ORG);
    expect(a.level).toBe("atencao");
  });

  it("saldo acima do mínimo do produto NÃO dispara", async () => {
    prisma.product.findMany.mockResolvedValue([prod({ stock: 31, minStock: 30 })]);
    expect(await getStockAlerts(ORG)).toHaveLength(0);
  });

  it("mínimo alto vence a régua padrão de 5 unidades", async () => {
    // Sem minStock, 50 unidades não alertariam; com minStock 80, alerta.
    prisma.product.findMany.mockResolvedValue([prod({ stock: 50, minStock: 80 })]);
    const [a] = await getStockAlerts(ORG);
    expect(a.level).toBe("atencao");
  });

  it("mínimo definido substitui a régua fixa (produto de giro baixo)", async () => {
    // 3 unidades cairia no "<= 5" padrão; com minStock 1, o lojista disse
    // que 3 está confortável — não deve alertar.
    prisma.product.findMany.mockResolvedValue([prod({ stock: 3, minStock: 1 })]);
    expect(await getStockAlerts(ORG)).toHaveLength(0);
  });

  it("sugestão de compra nunca fica abaixo do ponto de reposição", async () => {
    prisma.product.findMany.mockResolvedValue([prod({ stock: 10, minStock: 40 })]);
    const [a] = await getStockAlerts(ORG);
    // alvo = max(10 sem histórico, 40) = 40 → repor 30
    expect(a.suggestedReorder).toBe(30);
  });

  it("com venda rápida e saldo no mínimo, o nível vira crítico", async () => {
    // 60 vendidas em 14 dias ≈ 4,3/dia; 8 em estoque ≈ 1,9 dia restante.
    prisma.product.findMany.mockResolvedValue([prod({ stock: 8, minStock: 20 })]);
    prisma.saleItem.findMany.mockResolvedValue([{ productId: "p1", quantity: 60 }]);
    const [a] = await getStockAlerts(ORG);
    expect(a.level).toBe("critico");
  });
});
