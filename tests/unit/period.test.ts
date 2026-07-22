import { describe, it, expect } from "vitest";
import { parsePeriod, PERIODS } from "@/lib/endurance/period";

/**
 * `parsePeriod` alimenta a janela das consultas de painel. Só os períodos
 * oferecidos na tela podem passar — nada de `?dias=999999` varrendo o banco.
 */
describe("parsePeriod", () => {
  it("aceita os períodos oferecidos", () => {
    for (const p of PERIODS) {
      expect(parsePeriod({ dias: String(p.days) })).toBe(p.days);
    }
  });

  it("valor fora da lista cai no padrão de 30 dias", () => {
    for (const v of ["999999", "-5", "0", "abc", "31", ""]) {
      expect(parsePeriod({ dias: v })).toBe(30);
    }
  });

  it("sem parâmetro usa o padrão", () => {
    expect(parsePeriod({})).toBe(30);
  });

  it("respeita um padrão customizado", () => {
    expect(parsePeriod({ dias: "xyz" }, 90)).toBe(90);
  });
});
