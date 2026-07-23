import { describe, it, expect } from "vitest";
import {
  mealLabel,
  isKnownMeal,
  groupByMeal,
  type PlanItemLike,
} from "@/lib/endurance/meal-plan";

const item = (meal: string, food: string, position = 0): PlanItemLike => ({
  meal,
  food,
  amount: "",
  notes: "",
  position,
});

describe("mealLabel / isKnownMeal", () => {
  it("resolve rótulo de refeição conhecida e ecoa a chave desconhecida", () => {
    expect(mealLabel("almoco")).toBe("Almoço");
    expect(mealLabel("pos_treino")).toBe("pos_treino");
    expect(isKnownMeal("cafe_manha")).toBe(true);
    expect(isKnownMeal("pos_treino")).toBe(false);
  });
});

describe("groupByMeal", () => {
  it("agrupa e ordena as refeições na ordem canônica do dia", () => {
    const groups = groupByMeal([
      item("jantar", "Sopa"),
      item("cafe_manha", "Pão"),
      item("almoco", "Arroz"),
    ]);
    expect(groups.map((g) => g.meal)).toEqual(["cafe_manha", "almoco", "jantar"]);
  });

  it("ordena os itens dentro da refeição por position", () => {
    const groups = groupByMeal([
      item("almoco", "Feijão", 2),
      item("almoco", "Arroz", 0),
      item("almoco", "Salada", 1),
    ]);
    expect(groups[0].items.map((i) => i.food)).toEqual([
      "Arroz",
      "Salada",
      "Feijão",
    ]);
  });

  it("joga refeições desconhecidas para o fim, em ordem alfabética", () => {
    const groups = groupByMeal([
      item("zzz_custom", "X"),
      item("aaa_custom", "Y"),
      item("cafe_manha", "Pão"),
    ]);
    expect(groups.map((g) => g.meal)).toEqual([
      "cafe_manha",
      "aaa_custom",
      "zzz_custom",
    ]);
  });

  it("refeições sem itens não aparecem", () => {
    const groups = groupByMeal([item("almoco", "Arroz")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Almoço");
  });

  it("lista vazia → nenhum grupo", () => {
    expect(groupByMeal([])).toEqual([]);
  });
});
