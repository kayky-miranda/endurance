/**
 * Design system do vídeo — espelha a identidade do Endurance (dark mode +
 * esmeralda). Centraliza cores, fontes e defaults de animação.
 */

export const COLORS = {
  bg: "#0f1117",
  card: "#1a1d27",
  cardBorder: "#2a2d3a",
  foreground: "#f0f2f8",
  muted: "#6b7280",
  emerald: "#10b981",
  emeraldLight: "rgba(16, 185, 129, 0.12)",
  emeraldGlow: "rgba(16, 185, 129, 0.25)",
  emeraldBright: "#34d399",
  slate: "#64748b",
  blue: "#3b82f6",
  blueLight: "rgba(59, 130, 246, 0.12)",
  orange: "#f97316",
  orangeLight: "rgba(249, 115, 22, 0.12)",
  purple: "#8b5cf6",
  purpleLight: "rgba(139, 92, 246, 0.12)",
  red: "#ef4444",
  redLight: "rgba(239, 68, 68, 0.12)",
  gridLine: "rgba(240, 242, 248, 0.04)",
} as const;

export const SHADOW =
  "0 25px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.25)";

export const MONO = "'SF Mono', 'Fira Code', 'Cascadia Code', monospace";

/** Spring config padrão (damping 10, stiffness 150, mass 0.8). */
export const SPRING = {
  damping: 10,
  stiffness: 150,
  mass: 0.8,
  overshootClamping: false,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/**
 * Durações de cada cena em frames. AJUSTE conforme os MP3s reais do
 * ElevenLabs (ver README): ffprobe → segundos × 30 + 5 de padding.
 * Soma atual = 1380 frames (~46s).
 */
export const SCENE_FRAMES = {
  intro: 140,
  dor: 170,
  agitacao: 160,
  solucao: 150,
  onboarding: 170,
  modulos: 190,
  ia: 170,
  payoff: 120,
  cta: 110,
} as const;

export const TOTAL_FRAMES = Object.values(SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0,
);
