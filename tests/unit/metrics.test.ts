import { describe, it, expect } from "vitest";
import {
  presetOf,
  seriesStats,
  formatMetric,
  sparklinePoints,
} from "@/lib/endurance/metrics";

describe("presetOf", () => {
  it("acha um preset conhecido e devolve undefined p/ desconhecido", () => {
    expect(presetOf("peso")?.unit).toBe("kg");
    expect(presetOf("inexistente")).toBeUndefined();
  });
});

describe("seriesStats", () => {
  it("série vazia → null", () => {
    expect(seriesStats([])).toBeNull();
  });

  it("calcula primeiro/último/delta/mín/máx e direção", () => {
    const s = seriesStats([80, 78, 76])!;
    expect(s.first).toBe(80);
    expect(s.last).toBe(76);
    expect(s.delta).toBe(-4);
    expect(s.min).toBe(76);
    expect(s.max).toBe(80);
    expect(s.count).toBe(3);
    expect(s.direction).toBe("down");
  });

  it("para peso (menor é melhor), cair = melhora", () => {
    const s = seriesStats([90, 85], false)!;
    expect(s.improving).toBe(true);
  });

  it("para massa magra (maior é melhor), subir = melhora", () => {
    const up = seriesStats([30, 34], true)!;
    expect(up.improving).toBe(true);
    const down = seriesStats([34, 30], true)!;
    expect(down.improving).toBe(false);
  });

  it("série constante é 'flat' e conta como não-piora", () => {
    const s = seriesStats([70, 70, 70])!;
    expect(s.direction).toBe("flat");
    expect(s.improving).toBe(true);
    expect(s.delta).toBe(0);
  });
});

describe("formatMetric", () => {
  it("formata com casas decimais no padrão pt-BR", () => {
    expect(formatMetric(76.5, 1)).toBe("76,5");
    expect(formatMetric(120, 0)).toBe("120");
  });
});

describe("sparklinePoints", () => {
  it("série vazia → string vazia", () => {
    expect(sparklinePoints([], 100, 40)).toBe("");
  });

  it("um ponto vira uma linha reta no meio", () => {
    const p = sparklinePoints([5], 100, 40, 2);
    expect(p).toBe("2,20 98,20");
  });

  it("mapeia o mínimo no rodapé e o máximo no topo (Y invertido)", () => {
    // valores [0,10] em h=40, pad=0 → min y=40 (base), max y=0 (topo)
    const p = sparklinePoints([0, 10], 100, 40, 0);
    const coords = p.split(" ").map((c) => c.split(",").map(Number));
    expect(coords[0][1]).toBe(40); // primeiro (min) no rodapé
    expect(coords[1][1]).toBe(0); // último (max) no topo
    expect(coords[0][0]).toBe(0); // x inicial
    expect(coords[1][0]).toBe(100); // x final
  });
});
