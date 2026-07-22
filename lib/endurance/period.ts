/**
 * Período dos painéis, vindo da URL (?dias=7|30|90|365).
 *
 * Sem "server-only" e sem JSX de propósito: o parse roda no servidor (páginas)
 * e a lista alimenta os botões no cliente, então precisa ser importável dos
 * dois lados — e testável isoladamente.
 *
 * FRONTEIRA: o valor define a JANELA das consultas. Só passam os períodos
 * oferecidos na tela; qualquer outra coisa vira o padrão (nada de
 * `?dias=999999` varrendo o banco inteiro).
 */

export const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
] as const;

export function parsePeriod(sp: { dias?: string }, fallback = 30): number {
  const n = parseInt(sp.dias ?? "", 10);
  return PERIODS.some((p) => p.days === n) ? n : fallback;
}

/** Rótulo humano do período, para títulos e KPIs. */
export function periodLabel(days: number): string {
  return PERIODS.find((p) => p.days === days)?.label ?? `${days} dias`;
}
