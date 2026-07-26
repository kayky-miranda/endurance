/**
 * Lógica PURA da ficha de treino (sem banco): agrupamento de exercícios por
 * divisão do treino (A/B/C…). As divisões são texto livre, então a ordem segue
 * a primeira aparição (o profissional monta na ordem que quer).
 */

export const DEFAULT_GROUPS = ["A", "B", "C", "D", "E"] as const;

export interface WorkoutItemLike {
  group: string;
  exercise: string;
  sets: string;
  load: string;
  rest: string;
  notes: string;
  position: number;
}

export interface GroupedWorkout<T extends WorkoutItemLike> {
  group: string;
  items: T[];
}

/**
 * Agrupa por divisão preservando a ordem da primeira aparição de cada grupo;
 * dentro do grupo, ordena por `position`.
 */
export function groupByDivision<T extends WorkoutItemLike>(
  items: T[],
): GroupedWorkout<T>[] {
  const order: string[] = [];
  const byGroup = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => a.position - b.position);
  for (const it of sorted) {
    if (!byGroup.has(it.group)) {
      byGroup.set(it.group, []);
      order.push(it.group);
    }
    byGroup.get(it.group)!.push(it);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}
