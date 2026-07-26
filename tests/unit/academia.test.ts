import { describe, it, expect } from "vitest";
import {
  STUDENT_STATUSES,
  isValidStudentStatus,
} from "@/lib/endurance/students";
import { groupByDivision, type WorkoutItemLike } from "@/lib/endurance/workout";
import { computeImc, imcClass } from "@/lib/endurance/assessment";

describe("students", () => {
  it("valida as situações conhecidas", () => {
    expect(STUDENT_STATUSES).toEqual(["ativo", "inativo", "trancado"]);
    expect(isValidStudentStatus("ativo")).toBe(true);
    expect(isValidStudentStatus("congelado")).toBe(false);
  });
});

describe("groupByDivision", () => {
  const item = (group: string, exercise: string, position: number): WorkoutItemLike => ({
    group,
    exercise,
    sets: "",
    load: "",
    rest: "",
    notes: "",
    position,
  });

  it("agrupa por divisão na ordem da 1ª aparição JÁ ordenada por position", () => {
    // position é canônico: A tem a menor (0) → vem antes de B (min 3),
    // independentemente da ordem em que os itens chegam na lista.
    const groups = groupByDivision([
      item("B", "Agachamento", 3),
      item("A", "Supino", 0),
      item("B", "Leg press", 4),
      item("A", "Crucifixo", 1),
    ]);
    expect(groups.map((g) => g.group)).toEqual(["A", "B"]);
    expect(groups[0].items.map((i) => i.exercise)).toEqual(["Supino", "Crucifixo"]);
  });

  it("ordena exercícios dentro do grupo por position", () => {
    const groups = groupByDivision([
      item("A", "Rosca", 2),
      item("A", "Supino", 0),
      item("A", "Tríceps", 1),
    ]);
    expect(groups[0].items.map((i) => i.exercise)).toEqual([
      "Supino",
      "Tríceps",
      "Rosca",
    ]);
  });

  it("lista vazia → nenhum grupo", () => {
    expect(groupByDivision([])).toEqual([]);
  });
});

describe("computeImc / imcClass", () => {
  it("calcula IMC e arredonda a 1 casa", () => {
    // 80kg, 1.80m → 24.69… → 24.7
    expect(computeImc(80, 180)).toBe(24.7);
  });

  it("faltando peso ou altura → null", () => {
    expect(computeImc(null, 180)).toBeNull();
    expect(computeImc(80, null)).toBeNull();
    expect(computeImc(80, 0)).toBeNull();
  });

  it("classifica pelas faixas da OMS", () => {
    expect(imcClass(17)).toBe("abaixo");
    expect(imcClass(22)).toBe("normal");
    expect(imcClass(27)).toBe("sobrepeso");
    expect(imcClass(32)).toBe("obesidade_1");
    expect(imcClass(37)).toBe("obesidade_2");
    expect(imcClass(41)).toBe("obesidade_3");
    expect(imcClass(null)).toBeNull();
  });

  it("respeita os limites das faixas (18.5 e 25)", () => {
    expect(imcClass(18.5)).toBe("normal");
    expect(imcClass(25)).toBe("sobrepeso");
  });
});
