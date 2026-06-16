import type { BrandKitData } from "./types";
import type { NicheOrOther } from "@/lib/endurance/catalog";

export interface NichePreset {
  primaryColor: string;
  darkColor: string;
  lightColor: string;
  lightBg: string;
  darkBg: string;
  fontHeading: string;
  fontBody: string;
}

const PRESETS: Record<NicheOrOther, NichePreset> = {
  mercado_varejo: {
    primaryColor: "#16A34A",
    darkColor: "#14532D",
    lightColor: "#86EFAC",
    lightBg: "#F0FDF4",
    darkBg: "#0A1A0F",
    fontHeading: "Plus Jakarta Sans",
    fontBody: "Plus Jakarta Sans",
  },
  academia: {
    primaryColor: "#F97316",
    darkColor: "#7C2D12",
    lightColor: "#FED7AA",
    lightBg: "#FFF7ED",
    darkBg: "#1A0A00",
    fontHeading: "Space Grotesk",
    fontBody: "Space Grotesk",
  },
  cabelereiro: {
    primaryColor: "#DB2777",
    darkColor: "#831843",
    lightColor: "#FBCFE8",
    lightBg: "#FDF2F8",
    darkBg: "#1A0010",
    fontHeading: "Playfair Display",
    fontBody: "DM Sans",
  },
  nutricionista: {
    primaryColor: "#0891B2",
    darkColor: "#164E63",
    lightColor: "#A5F3FC",
    lightBg: "#F0FDFF",
    darkBg: "#030F14",
    fontHeading: "Lora",
    fontBody: "Nunito Sans",
  },
  outro: {
    primaryColor: "#6366F1",
    darkColor: "#312E81",
    lightColor: "#A5B4FC",
    lightBg: "#F8F7FF",
    darkBg: "#0F0E17",
    fontHeading: "Plus Jakarta Sans",
    fontBody: "Plus Jakarta Sans",
  },
};

export function presetForNiche(niche: NicheOrOther): NichePreset {
  return PRESETS[niche] ?? PRESETS.outro;
}

export function resolveBrandKit(
  niche: NicheOrOther,
  orgKit?: Partial<BrandKitData>,
  orgName = "",
): BrandKitData {
  const preset = presetForNiche(niche);
  return {
    primaryColor: orgKit?.primaryColor ?? preset.primaryColor,
    darkColor: orgKit?.darkColor ?? preset.darkColor,
    lightColor: orgKit?.lightColor ?? preset.lightColor,
    lightBg: orgKit?.lightBg ?? preset.lightBg,
    darkBg: orgKit?.darkBg ?? preset.darkBg,
    fontHeading: orgKit?.fontHeading ?? preset.fontHeading,
    fontBody: orgKit?.fontBody ?? preset.fontBody,
    logoText: orgKit?.logoText ?? orgName,
    tagline: orgKit?.tagline ?? "",
    instagramHandle: orgKit?.instagramHandle ?? "",
  };
}
