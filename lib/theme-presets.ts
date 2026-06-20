/**
 * Presets de white-label. Cada preset define a paleta completa (cores brand
 * + chrome de sidebar/header). O usuário pode escolher um preset e depois
 * ajustar manualmente — o presetId fica como "memória" do botão clicado.
 *
 * As cores `_50/_200/_300/_400/_600` são derivadas automaticamente a partir
 * da primary se o preset não definir explicitamente.
 */

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  primary: string; // brand-500
  primaryDark: string; // brand-600
  primaryLight: string; // brand-400
  primaryLighter: string; // brand-300
  primarySoft: string; // brand-200
  primaryFaint: string; // brand-50
  buttonText: string;
  // Chrome (sidebar/header) — paleta tom sobre tom
  chrome950: string;
  chrome900: string;
  chrome800: string;
  chrome700: string;
  chrome600: string;
}

export const DEFAULT_PRESET: ThemePreset = {
  id: "default",
  label: "Polar (padrão)",
  description: "Ciano glacial sobre azul-noite. O visual original do ENDURANCE.",
  primaryFaint: "#ecfeff",
  primarySoft: "#a5f3fc",
  primaryLighter: "#67e8f9",
  primaryLight: "#22d3ee",
  primary: "#06b6d4",
  primaryDark: "#0891b2",
  buttonText: "#060912",
  chrome950: "#060912",
  chrome900: "#0a0f1d",
  chrome800: "#0f1628",
  chrome700: "#18223a",
  chrome600: "#273456",
};

export const THEME_PRESETS: ThemePreset[] = [
  DEFAULT_PRESET,
  {
    id: "azul_corporativo",
    label: "Azul Corporativo",
    description: "Azul sólido e sóbrio — clássico de banco/escritório.",
    primaryFaint: "#eff6ff",
    primarySoft: "#bfdbfe",
    primaryLighter: "#93c5fd",
    primaryLight: "#60a5fa",
    primary: "#2563eb",
    primaryDark: "#1d4ed8",
    buttonText: "#ffffff",
    chrome950: "#0b1220",
    chrome900: "#0f1a2e",
    chrome800: "#172339",
    chrome700: "#1f2f4d",
    chrome600: "#324b71",
  },
  {
    id: "verde_empresarial",
    label: "Verde Empresarial",
    description: "Verde esmeralda — combina com cooperativa, agro e contabilidade.",
    primaryFaint: "#ecfdf5",
    primarySoft: "#a7f3d0",
    primaryLighter: "#6ee7b7",
    primaryLight: "#34d399",
    primary: "#10b981",
    primaryDark: "#059669",
    buttonText: "#06120a",
    chrome950: "#06140d",
    chrome900: "#0a1f15",
    chrome800: "#102b1d",
    chrome700: "#1a3a2a",
    chrome600: "#2a513f",
  },
  {
    id: "vermelho_comercial",
    label: "Vermelho Comercial",
    description: "Vermelho carmim — varejo agressivo, ofertas, alta conversão.",
    primaryFaint: "#fef2f2",
    primarySoft: "#fecaca",
    primaryLighter: "#fca5a5",
    primaryLight: "#f87171",
    primary: "#dc2626",
    primaryDark: "#b91c1c",
    buttonText: "#ffffff",
    chrome950: "#120808",
    chrome900: "#1f0e0e",
    chrome800: "#2c1414",
    chrome700: "#3d1d1d",
    chrome600: "#552b2b",
  },
  {
    id: "roxo_moderno",
    label: "Roxo Moderno",
    description: "Roxo vibrante — tecnologia, beleza, serviços criativos.",
    primaryFaint: "#f5f3ff",
    primarySoft: "#ddd6fe",
    primaryLighter: "#c4b5fd",
    primaryLight: "#a78bfa",
    primary: "#7c3aed",
    primaryDark: "#6d28d9",
    buttonText: "#ffffff",
    chrome950: "#0c0820",
    chrome900: "#150f2e",
    chrome800: "#1f1740",
    chrome700: "#2c2057",
    chrome600: "#3f2e7a",
  },
  {
    id: "preto_premium",
    label: "Preto Premium",
    description: "Preto + dourado — boutique, restaurante fino, joalheria.",
    primaryFaint: "#fef9c3",
    primarySoft: "#fde68a",
    primaryLighter: "#fcd34d",
    primaryLight: "#fbbf24",
    primary: "#d97706",
    primaryDark: "#b45309",
    buttonText: "#1c1208",
    chrome950: "#050505",
    chrome900: "#0c0c0c",
    chrome800: "#1a1a1a",
    chrome700: "#262626",
    chrome600: "#404040",
  },
];

export function presetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
