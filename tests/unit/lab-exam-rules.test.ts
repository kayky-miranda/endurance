import { describe, it, expect } from "vitest";
import {
  classifyExam,
  formatRange,
  compareWithPrevious,
  SEVERE_DEVIATION,
} from "@/lib/endurance/lab-exam-rules";

/**
 * A classificação sai SÓ da faixa de referência do laudo. O sistema nunca deve
 * "achar" que um valor é anormal por conhecimento embutido — sem faixa, sem
 * classificação.
 */
describe("classifyExam", () => {
  const glicemia = { refMin: 70, refMax: 99 };

  it("dentro da faixa é normal", () => {
    expect(classifyExam(85, glicemia).flag).toBe("normal");
    expect(classifyExam(70, glicemia).flag).toBe("normal"); // limite inclusivo
    expect(classifyExam(99, glicemia).flag).toBe("normal");
  });

  it("acima e abaixo da faixa", () => {
    expect(classifyExam(120, glicemia).flag).toBe("alto");
    expect(classifyExam(60, glicemia).flag).toBe("baixo");
  });

  it("sem faixa NÃO classifica", () => {
    const r = classifyExam(500, { refMin: null, refMax: null });
    expect(r.flag).toBe("sem_referencia");
    expect(r.severe).toBe(false);
  });

  it("faixa só com máximo (ex.: colesterol < 200)", () => {
    expect(classifyExam(180, { refMin: null, refMax: 200 }).flag).toBe("normal");
    expect(classifyExam(240, { refMin: null, refMax: 200 }).flag).toBe("alto");
  });

  it("faixa só com mínimo (ex.: HDL > 40)", () => {
    expect(classifyExam(55, { refMin: 40, refMax: null }).flag).toBe("normal");
    expect(classifyExam(30, { refMin: 40, refMax: null }).flag).toBe("baixo");
  });

  it("marca desvio grande como severo", () => {
    const leve = classifyExam(105, glicemia); // ~6% acima
    expect(leve.severe).toBe(false);

    const grave = classifyExam(200, glicemia); // ~102% acima
    expect(grave.severe).toBe(true);
    expect(grave.deviation).toBeGreaterThan(SEVERE_DEVIATION);
  });

  it("limite zero não quebra o cálculo de desvio", () => {
    const r = classifyExam(5, { refMin: null, refMax: 0 });
    expect(r.flag).toBe("alto");
    expect(Number.isFinite(r.deviation)).toBe(true);
  });
});

describe("formatRange", () => {
  it("formata os três formatos de laudo", () => {
    expect(formatRange({ refMin: 70, refMax: 99 }, "mg/dL")).toBe("70 – 99 mg/dL");
    expect(formatRange({ refMin: null, refMax: 200 }, "mg/dL")).toBe("< 200 mg/dL");
    expect(formatRange({ refMin: 40, refMax: null }, "mg/dL")).toBe("> 40 mg/dL");
    expect(formatRange({ refMin: null, refMax: null }, "mg/dL")).toBe("—");
  });
});

describe("compareWithPrevious", () => {
  it("primeiro resultado não tem comparação", () => {
    expect(compareWithPrevious(100, null)).toEqual({ trend: "primeiro", delta: 0 });
  });

  it("relata o movimento sem julgar se é bom ou ruim", () => {
    expect(compareWithPrevious(120, 100)).toEqual({ trend: "subiu", delta: 20 });
    expect(compareWithPrevious(80, 100)).toEqual({ trend: "desceu", delta: -20 });
    expect(compareWithPrevious(100, 100)).toEqual({ trend: "estavel", delta: 0 });
  });
});
