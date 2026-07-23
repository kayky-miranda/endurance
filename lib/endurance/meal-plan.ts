/**
 * Lógica PURA do plano alimentar (sem banco, sem "server-only"): as refeições
 * padrão do dia, seus rótulos e o agrupamento/ordenação dos itens por refeição.
 * Reutilizável no cliente (editor) e no servidor.
 */

export interface MealSection {
  meal: string;
  label: string;
}

export const MEAL_SECTIONS: MealSection[] = [
  { meal: "cafe_manha", label: "Café da manhã" },
  { meal: "lanche_manha", label: "Lanche da manhã" },
  { meal: "almoco", label: "Almoço" },
  { meal: "lanche_tarde", label: "Lanche da tarde" },
  { meal: "jantar", label: "Jantar" },
  { meal: "ceia", label: "Ceia" },
];

const ORDER = new Map(MEAL_SECTIONS.map((s, i) => [s.meal, i]));

export function mealLabel(meal: string): string {
  return MEAL_SECTIONS.find((s) => s.meal === meal)?.label ?? meal;
}

export function isKnownMeal(meal: string): boolean {
  return ORDER.has(meal);
}

export interface PlanItemLike {
  meal: string;
  food: string;
  amount: string;
  notes: string;
  position: number;
}

export interface GroupedMeal<T extends PlanItemLike> {
  meal: string;
  label: string;
  items: T[];
}

/**
 * Agrupa itens por refeição na ordem canônica do dia (refeições desconhecidas
 * vão para o fim, em ordem alfabética). Dentro de cada refeição, ordena por
 * `position`. Refeições sem item não aparecem.
 */
export function groupByMeal<T extends PlanItemLike>(items: T[]): GroupedMeal<T>[] {
  const byMeal = new Map<string, T[]>();
  for (const it of items) {
    const list = byMeal.get(it.meal) ?? [];
    list.push(it);
    byMeal.set(it.meal, list);
  }
  const rank = (meal: string) =>
    ORDER.has(meal) ? (ORDER.get(meal) as number) : MEAL_SECTIONS.length;

  return [...byMeal.entries()]
    .sort((a, b) => {
      const ra = rank(a[0]);
      const rb = rank(b[0]);
      return ra !== rb ? ra - rb : a[0].localeCompare(b[0]);
    })
    .map(([meal, list]) => ({
      meal,
      label: mealLabel(meal),
      items: [...list].sort((x, y) => x.position - y.position),
    }));
}
