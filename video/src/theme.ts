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

export const SPRING = {
  damping: 14,
  stiffness: 220,
  mass: 0.5,
  overshootClamping: false,
} as const;

export const SPRING_SNAPPY = {
  damping: 18,
  stiffness: 300,
  mass: 0.4,
  overshootClamping: false,
} as const;

export const SPRING_BOUNCY = {
  damping: 8,
  stiffness: 180,
  mass: 0.6,
  overshootClamping: false,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

export const SCENE_FRAMES = {
  intro: 153,
  dor: 299,
  agitacao: 234,
  solucao: 251,
  onboarding: 290,
  modulos: 315,
  ia: 313,
  payoff: 168,
  cta: 88,
} as const;

export const TOTAL_FRAMES = Object.values(SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0,
);
