"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
import { askAssistant, type ChatMsg, type Widget } from "@/lib/endurance/assistant";
import { moduleById } from "@/lib/endurance/catalog";

export type AssistantReply =
  | { ok: true; reply: string; widgets: Widget[] }
  | { ok: false; error: string };

export async function assistantAction(
  messages: ChatMsg[],
): Promise<AssistantReply> {
<<<<<<< HEAD
=======
import { askAssistant, type ChatMsg } from "@/lib/endurance/assistant";
import { moduleById } from "@/lib/endurance/catalog";

export async function assistantAction(
  messages: ChatMsg[],
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
    {
      orgId: s.org,
      orgName: org.name,
      nicheLabel: org.nicheLabel,
      modules: moduleLabels,
    },
<<<<<<< HEAD
=======
    { orgName: org.name, nicheLabel: org.nicheLabel, modules: moduleLabels },
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
    Array.isArray(messages) ? messages : [],
  );
}
