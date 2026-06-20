import { describe, it, expect } from "vitest";
import { contrastRatio, wcagLevel } from "@/lib/theme-contrast";

describe("contrastRatio", () => {
  it("preto sobre branco devolve 21 (máximo possível)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("igual sobre igual devolve 1 (sem contraste)", () => {
    expect(contrastRatio("#06b6d4", "#06b6d4")).toBeCloseTo(1, 2);
  });

  it("aceita hex com e sem #", () => {
    expect(contrastRatio("000000", "ffffff")).toBeCloseTo(21, 0);
  });

  it("entrada inválida devolve 0", () => {
    expect(contrastRatio("xyz", "#fff")).toBe(0);
    expect(contrastRatio("#000", "abc")).toBe(0);
  });
});

describe("wcagLevel", () => {
  it("AAA para >= 7", () => {
    expect(wcagLevel(8)).toBe("AAA");
    expect(wcagLevel(7)).toBe("AAA");
  });
  it("AA para 4.5–6.99", () => {
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(6.9)).toBe("AA");
  });
  it("AA-large para 3–4.49", () => {
    expect(wcagLevel(3)).toBe("AA-large");
    expect(wcagLevel(4.4)).toBe("AA-large");
  });
  it("fail abaixo de 3", () => {
    expect(wcagLevel(2.9)).toBe("fail");
    expect(wcagLevel(1)).toBe("fail");
  });

  it("paleta padrão (texto escuro sobre primary cyan) atinge AA", () => {
    const r = contrastRatio("#060912", "#06b6d4");
    expect(wcagLevel(r)).not.toBe("fail");
  });

  it("preset Vermelho Comercial (branco sobre vermelho) atinge AA", () => {
    const r = contrastRatio("#ffffff", "#dc2626");
    expect(wcagLevel(r)).not.toBe("fail");
  });
});
