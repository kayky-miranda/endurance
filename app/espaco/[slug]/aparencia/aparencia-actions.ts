"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { presetById } from "@/lib/theme-presets";
import { logActivity } from "@/lib/endurance/activity-log";

type Result = { ok: true } | { ok: false; error: string };

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
function hex(v: unknown): string | null {
  return typeof v === "string" && HEX_RE.test(v) ? v : null;
}

export interface ThemeInput {
  presetId: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  buttonTextColor?: string | null;
  sidebarBg?: string | null;
  sidebarBgDark?: string | null;
  textColor?: string | null;
  cardBg?: string | null;
  defaultDarkMode?: boolean;
}

/**
 * Aparência é uma decisão de marca da empresa — exige team.manage (OWNER/ADMIN).
 * Sem permissão própria pra não inflar o catálogo de permissions.
 */
export async function saveThemeAction(input: ThemeInput): Promise<Result> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  const preset = presetById(input.presetId);
  if (!preset) return { ok: false, error: "Preset inválido." };

  const data = {
    presetId: input.presetId,
    primaryColor: hex(input.primaryColor),
    secondaryColor: hex(input.secondaryColor),
    accentColor: hex(input.accentColor),
    buttonTextColor: hex(input.buttonTextColor),
    sidebarBg: hex(input.sidebarBg),
    sidebarBgDark: hex(input.sidebarBgDark),
    textColor: hex(input.textColor),
    cardBg: hex(input.cardBg),
    defaultDarkMode: !!input.defaultDarkMode,
    updatedById: session.sub,
  };

  await prisma.themeSettings.upsert({
    where: { organizationId: session.org },
    create: { organizationId: session.org, ...data },
    update: data,
  });

  await logActivity(session, "theme.update", `Aparência atualizada (preset: ${preset.label})`);
  revalidatePath(`/espaco/${session.slug}`, "layout");
  return { ok: true };
}

export async function resetThemeAction(): Promise<Result> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const session = gate.session;

  await prisma.themeSettings.deleteMany({ where: { organizationId: session.org } });
  await logActivity(session, "theme.reset", "Aparência restaurada para o padrão");
  revalidatePath(`/espaco/${session.slug}`, "layout");
  return { ok: true };
}
