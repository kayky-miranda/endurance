import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  askAssistantStream,
  type AssistantEvent,
  type ChatMsg,
} from "@/lib/endurance/assistant";
import { moduleById } from "@/lib/endurance/catalog";

export const runtime = "nodejs";

/**
 * Assistente em streaming. Server actions não transmitem progressivamente,
 * então o chat usa esta rota: cada evento do agente (ferramenta consultada,
 * widget pronto, pedaço de texto) sai como uma linha NDJSON.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Não autorizado.", { status: 401 });

  let messages: ChatMsg[] = [];
  try {
    const body = (await req.json()) as { messages?: unknown };
    if (Array.isArray(body.messages)) {
      messages = body.messages
        .filter(
          (m): m is ChatMsg =>
            Boolean(m) &&
            ((m as ChatMsg).role === "user" ||
              (m as ChatMsg).role === "assistant") &&
            typeof (m as ChatMsg).content === "string",
        )
        .slice(-12);
    }
  } catch {
    return new Response("Corpo inválido.", { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.org },
    include: { modules: true },
  });
  if (!org) return new Response("Empresa não encontrada.", { status: 404 });

  const moduleLabels = org.modules
    .map((m) => moduleById(m.moduleId)?.label)
    .filter((x): x is string => Boolean(x));

  const gen = askAssistantStream(
    {
      orgId: session.org,
      orgName: org.name,
      nicheLabel: org.nicheLabel,
      modules: moduleLabels,
    },
    messages,
  );

  const encoder = new TextEncoder();
  const line = (ev: AssistantEvent) =>
    encoder.encode(JSON.stringify(ev) + "\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of gen) controller.enqueue(line(ev));
      } catch (e) {
        console.error("[api:assistant] stream:", e);
        controller.enqueue(
          line({ type: "error", error: "Falha ao falar com a IA." }),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Cliente abortou (fechou o chat): encerra o agente.
      void gen.return();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
