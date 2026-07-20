import { describe, it, expect } from "vitest";
import { FinalizeSaleSchema, CustomerSchema } from "@/lib/validation";

const base = {
  token: "tok-12345678",
  items: [{ productId: "p1", qty: 2 }],
};

describe("FinalizeSaleSchema — higiene do caminho do dinheiro", () => {
  it("aceita venda válida e normaliza desconto/pagamentos", () => {
    const r = FinalizeSaleSchema.safeParse({
      ...base,
      discount: 1.999,
      payments: [{ method: "dinheiro", amount: 10.005 }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.discount).toBe(2);
      expect(r.data.payments[0].amount).toBe(10.01);
    }
  });

  it("desconto NaN vira 0 (não NaN no total)", () => {
    const r = FinalizeSaleSchema.safeParse({ ...base, discount: Number.NaN });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.discount).toBe(0);
  });

  it("quantidade fracionária é recusada (coluna Int)", () => {
    const r = FinalizeSaleSchema.safeParse({
      ...base,
      items: [{ productId: "p1", qty: 0.5 }],
    });
    expect(r.success).toBe(false);
  });

  it("quantidade absurda é recusada", () => {
    const r = FinalizeSaleSchema.safeParse({
      ...base,
      items: [{ productId: "p1", qty: 1_000_000 }],
    });
    expect(r.success).toBe(false);
  });

  it("método de pagamento desconhecido é recusado", () => {
    const r = FinalizeSaleSchema.safeParse({
      ...base,
      payments: [{ method: "cheque", amount: 10 }],
    });
    expect(r.success).toBe(false);
  });

  it("carrinho vazio é recusado", () => {
    const r = FinalizeSaleSchema.safeParse({ ...base, items: [] });
    expect(r.success).toBe(false);
  });
});

describe("CustomerSchema", () => {
  it("normaliza e-mail e aceita campos vazios", () => {
    const r = CustomerSchema.safeParse({ name: "  Ana  ", email: "ANA@X.COM" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Ana");
      expect(r.data.email).toBe("ana@x.com");
      expect(r.data.phone).toBe("");
    }
  });

  it("e-mail inválido é recusado", () => {
    expect(CustomerSchema.safeParse({ name: "Ana", email: "x" }).success).toBe(false);
  });
});
