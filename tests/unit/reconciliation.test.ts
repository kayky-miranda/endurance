import { describe, it, expect } from "vitest";
import { classify } from "@/lib/endurance/reconciliation";

describe("classify (estado de conciliação PIX)", () => {
  it("pago + venda + recebível de igual valor → conciliado", () => {
    expect(classify("pago", "sale_1", 50, 50)).toBe("conciliado");
  });

  it("pago + venda + valor divergente → divergente", () => {
    expect(classify("pago", "sale_1", 50, 49.9)).toBe("divergente");
  });

  it("pago + venda sem recebível → divergente", () => {
    expect(classify("pago", "sale_1", 50, null)).toBe("divergente");
  });

  it("pago sem venda → pago_sem_venda", () => {
    expect(classify("pago", null, 50, null)).toBe("pago_sem_venda");
  });

  it("pendente → pendente", () => {
    expect(classify("pendente", null, 50, null)).toBe("pendente");
  });

  it("expirado/cancelado preservados", () => {
    expect(classify("expirado", null, 50, null)).toBe("expirado");
    expect(classify("cancelado", null, 50, null)).toBe("cancelado");
  });

  it("tolera diferença de centavo (arredondamento)", () => {
    expect(classify("pago", "sale_1", 50, 50.004)).toBe("conciliado");
  });
});
