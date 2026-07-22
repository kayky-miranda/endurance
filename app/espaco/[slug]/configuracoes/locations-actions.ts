"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import {
  createLocation,
  updateLocation,
  setDefaultLocation,
  setLocationActive,
} from "@/lib/endurance/locations";

type R = { ok: boolean; error?: string };

function revalidate(slug: string) {
  revalidatePath(`/espaco/${slug}/configuracoes`);
  revalidatePath(`/espaco/${slug}/m/estoque`);
  revalidatePath(`/espaco/${slug}/m/transferencias`);
}

export async function createLocationAction(input: {
  name: string;
  code?: string;
  city?: string;
  state?: string;
}): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createLocation(s.org, input);
  if (!res.ok) return res;
  await logActivity(s, "location.create", `Criou o local "${input.name}"`, res.id);
  revalidate(s.slug);
  return { ok: true };
}

export async function updateLocationAction(
  id: string,
  input: { name?: string; code?: string; city?: string; state?: string },
): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await updateLocation(s.org, id, input);
  if (!res.ok) return res;
  await logActivity(s, "location.update", `Editou o local "${input.name ?? id}"`, id);
  revalidate(s.slug);
  return { ok: true };
}

export async function setDefaultLocationAction(id: string): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setDefaultLocation(s.org, id);
  if (!res.ok) return res;
  await logActivity(s, "location.default", "Definiu o local padrão da organização", id);
  revalidate(s.slug);
  return { ok: true };
}

export async function setLocationActiveAction(
  id: string,
  active: boolean,
): Promise<R> {
  const gate = await requirePermission("settings.general");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await setLocationActive(s.org, id, active);
  if (!res.ok) return res;
  await logActivity(
    s,
    active ? "location.activate" : "location.deactivate",
    `${active ? "Ativou" : "Inativou"} um local de estoque`,
    id,
  );
  revalidate(s.slug);
  return { ok: true };
}

/** Define em qual local um membro da equipe opera (PDV/conferência). */
export async function setUserLocationAction(
  userId: string,
  locationId: string | null,
): Promise<R> {
  const gate = await requirePermission("team.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: s.org },
    select: { id: true, name: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  if (locationId) {
    const loc = await prisma.location.findFirst({
      where: { id: locationId, organizationId: s.org, active: true },
      select: { id: true },
    });
    if (!loc) return { ok: false, error: "Local inválido." };
  }

  await prisma.user.update({ where: { id: userId }, data: { locationId } });
  await logActivity(
    s,
    "user.location",
    `Definiu o local de operação de ${user.name}`,
    userId,
  );
  revalidatePath(`/espaco/${s.slug}/equipe`);
  return { ok: true };
}
