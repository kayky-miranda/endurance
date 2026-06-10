"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { askAssistant, type ChatMsg, type Widget } from "@/lib/endurance/assistant";
import { moduleById } from "@/lib/endurance/catalog";

export type AssistantReply =
  | { ok: true; reply: string; widgets: Widget[] }
  | { ok: false; error: string };

export async function assistantAction(
  messages: ChatMsg[],
): Promise<AssistantReply> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão expirada." };

  const org = await prisma.organization.findUnique({
    where: { id: s.org },
    include: { modules: true },
  });
  if (!org) return { ok: false, error: "Empresa não encontrada." };

  const moduleLabels = org.modules
    .map((m) => moduleById(m.moduleId)?.label)
    .filter((x): x is string => Boolean(x));

  return askAssistant(
    {
      orgId: s.org,
      orgName: org.name,
      nicheLabel: org.nicheLabel,
      modules: moduleLabels,
    },
    Array.isArray(messages) ? messages : [],
  );
}
