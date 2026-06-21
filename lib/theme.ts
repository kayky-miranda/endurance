import "server-only";
import { prisma } from "@/lib/db";
import { cache } from "react";
import { DEFAULT_PRESET, presetById, type ThemePreset } from "@/lib/theme-presets";

/**
 * Resolve o tema aplicado a uma organização: parte do preset escolhido e
 * sobrescreve com os overrides individuais (cada campo é opcional). Retorna
 * sempre uma paleta completa.
 *
 * Cacheado por request com React cache() — o layout do espaço e o page.tsx
 * compartilham a mesma resolução.
 */
export interface ResolvedTheme {
  preset: ThemePreset;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryLighter: string;
  primarySoft: string;
  primaryFaint: string;
  buttonText: string;
  chrome950: string;
  chrome900: string;
  chrome800: string;
  chrome700: string;
  chrome600: string;
  defaultDarkMode: boolean;
  presetId: string;
  logoDataUrl: string | null;
  logoMime: string | null;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function pick(custom: string | null | undefined, fallback: string): string {
  return custom && HEX_RE.test(custom) ? custom : fallback;
}

export const resolveTheme = cache(async function resolveTheme(
  orgId: string,
): Promise<ResolvedTheme> {
  const row = await prisma.themeSettings.findUnique({
    where: { organizationId: orgId },
  });
  const preset = (row && presetById(row.presetId)) || DEFAULT_PRESET;
  return {
    preset,
    presetId: preset.id,
    primary: pick(row?.primaryColor, preset.primary),
    primaryDark: pick(null, preset.primaryDark),
    primaryLight: pick(null, preset.primaryLight),
    primaryLighter: pick(null, preset.primaryLighter),
    primarySoft: pick(row?.secondaryColor, preset.primarySoft),
    primaryFaint: pick(null, preset.primaryFaint),
    buttonText: pick(row?.buttonTextColor, preset.buttonText),
    chrome950: pick(row?.sidebarBgDark, preset.chrome950),
    chrome900: pick(null, preset.chrome900),
    chrome800: pick(null, preset.chrome800),
    chrome700: pick(null, preset.chrome700),
    chrome600: pick(null, preset.chrome600),
    defaultDarkMode: row?.defaultDarkMode ?? false,
    logoDataUrl: row?.logoDataUrl ?? null,
    logoMime: row?.logoMime ?? null,
  };
});

/**
 * Serializa o tema resolvido como CSS inline pra ser injetado num <style>
 * dentro do shell. Sobrescreve as vars definidas em globals.css.
 */
export function themeToCss(theme: ResolvedTheme): string {
  return `:root{
--color-brand-50:${theme.primaryFaint};
--color-brand-200:${theme.primarySoft};
--color-brand-300:${theme.primaryLighter};
--color-brand-400:${theme.primaryLight};
--color-brand-500:${theme.primary};
--color-brand-600:${theme.primaryDark};
--color-ink-950:${theme.chrome950};
--color-ink-900:${theme.chrome900};
--color-ink-800:${theme.chrome800};
--color-ink-700:${theme.chrome700};
--color-ink-600:${theme.chrome600};
--color-button-text:${theme.buttonText};
}`;
}
