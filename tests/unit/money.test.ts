import { describe, expect, it } from "vitest";
import { money } from "@/lib/endurance/money";

describe("money (borda de leitura Decimal → number)", () => {
  it("nulos viram 0", () => {
    expect(money(null)).toBe(0);
    expect(money(undefined)).toBe(0);
  });

  it("aceita number, string e objetos Decimal-like (via Number())", () => {
    expect(money(10)).toBe(10);
    expect(money("3.14")).toBe(3.14);
    expect(money("12.20")).toBe(12.2);
  });

  it("arredonda ruído de ponto flutuante para 2 casas", () => {
    expect(money(0.1 + 0.2)).toBe(0.3);
    expect(money(19.999999999999996)).toBe(20);
  });
});
