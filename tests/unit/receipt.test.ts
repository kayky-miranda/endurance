import { describe, it, expect } from "vitest";
import { buildReceiptMessage } from "@/lib/endurance/receipt";

const SALE = {
  id: "clxabc000111f7ws4x",
  total: 21,
  createdAt: new Date("2026-06-13T23:08:00-03:00"),
  items: [
    { name: "Refri 2L", quantity: 1, unitPrice: 12 },
    { name: "Pão", quantity: 3, unitPrice: 3 },
  ],
  payments: [{ method: "pix", amount: 21 }],
};

describe("buildReceiptMessage", () => {
  const msg = buildReceiptMessage("Mercadinho do Zé", SALE);

  // money() formata com Intl, que usa espaço não-quebrável após "R$"; os testes
  // checam só os números para não depender desse caractere.
  it("inclui o estabelecimento, o código e o total", () => {
    expect(msg).toContain("Mercadinho do Zé");
    expect(msg).toContain("#F7WS4X"); // últimos 6 do id, maiúsculo
    expect(msg).toContain("21,00");
    expect(msg).toContain("Pix");
  });

  it("lista os itens com quantidade e subtotal", () => {
    expect(msg).toContain("1x Refri 2L");
    expect(msg).toContain("3x Pão");
    expect(msg).toContain("9,00"); // 3 x 3,00
  });

  it("resume itens quando há mais de 12", () => {
    const many = {
      ...SALE,
      items: Array.from({ length: 15 }, (_, i) => ({
        name: `Item ${i}`,
        quantity: 1,
        unitPrice: 1,
      })),
    };
    expect(buildReceiptMessage("Loja", many)).toContain("e mais 3 item(ns)");
  });
});
