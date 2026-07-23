/**
 * Lógica PURA da evolução do paciente (sem banco, sem "server-only"): presets
 * de indicadores por nicho, estatística de série (primeiro/último/variação/
 * mín/máx/tendência) e formatação. Testável e reutilizável no cliente.
 */

export interface MetricPreset {
  metric: string;
  label: string;
  unit: string;
  /** Para a maioria dos indicadores clínicos, cair é a melhoria (peso, gordura).
   * `higherIsBetter: true` inverte (ex.: massa magra, escala de bem-estar). */
  higherIsBetter?: boolean;
  decimals: number;
}

export const METRIC_PRESETS: MetricPreset[] = [
  { metric: "peso", label: "Peso", unit: "kg", decimals: 1 },
  { metric: "gordura", label: "% de gordura", unit: "%", decimals: 1 },
  { metric: "massa_magra", label: "Massa magra", unit: "kg", higherIsBetter: true, decimals: 1 },
  { metric: "abdomen", label: "Circunf. abdominal", unit: "cm", decimals: 1 },
  { metric: "cintura", label: "Cintura", unit: "cm", decimals: 1 },
  { metric: "quadril", label: "Quadril", unit: "cm", decimals: 1 },
  { metric: "imc", label: "IMC", unit: "kg/m²", decimals: 1 },
  { metric: "glicemia", label: "Glicemia", unit: "mg/dL", decimals: 0 },
  { metric: "pressao_sistolica", label: "Pressão sistólica", unit: "mmHg", decimals: 0 },
  { metric: "pressao_diastolica", label: "Pressão diastólica", unit: "mmHg", decimals: 0 },
  { metric: "escala_bemestar", label: "Escala de bem-estar (0–10)", unit: "", higherIsBetter: true, decimals: 0 },
  { metric: "escala_ansiedade", label: "Escala de ansiedade (0–10)", unit: "", decimals: 0 },
];

export function presetOf(metric: string): MetricPreset | undefined {
  return METRIC_PRESETS.find((p) => p.metric === metric);
}

export type TrendDirection = "up" | "down" | "flat";

export interface SeriesStats {
  first: number;
  last: number;
  delta: number; // last - first
  min: number;
  max: number;
  count: number;
  direction: TrendDirection;
  /** true = a variação representa melhora clínica (considerando higherIsBetter). */
  improving: boolean;
}

/**
 * Estatística de uma série já ORDENADA por data (mais antigo → mais recente).
 * Retorna null para série vazia.
 */
export function seriesStats(
  values: number[],
  higherIsBetter = false,
): SeriesStats | null {
  if (values.length === 0) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const delta = round3(last - first);
  const direction: TrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const improving =
    delta === 0 ? true : higherIsBetter ? delta > 0 : delta < 0;
  return {
    first,
    last,
    delta,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
    direction,
    improving,
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function formatMetric(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Pontos de uma sparkline SVG (viewBox 0..w x 0..h) a partir dos valores em
 * ordem cronológica. Normaliza pelo mín/máx; série constante vira uma linha no
 * meio. Y é invertido (0 no topo do SVG). Devolve string "x,y x,y …".
 */
export function sparklinePoints(
  values: number[],
  w: number,
  h: number,
  pad = 2,
): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const midY = h / 2;
    return `${pad},${midY} ${w - pad},${midY}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = pad + (1 - (v - min) / span) * innerH;
      return `${round3(x)},${round3(y)}`;
    })
    .join(" ");
}
