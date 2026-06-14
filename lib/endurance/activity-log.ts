import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";

/** Dados mínimos da sessão necessários para atribuir uma ação a um ator. */
type Actor = Pick<SessionPayload, "org" | "sub" | "name">;

/**
 * Grava uma entrada na trilha de auditoria (ActivityLog).
 *
 * É best-effort por design: uma falha ao registrar a atividade NUNCA deve
 * quebrar a ação de negócio que a originou (emissão fiscal, baixa financeira,
 * ajuste de estoque etc.). Por isso o erro é apenas logado no servidor.
 *
 * Convenção de `action`: `<dominio>.<verbo>` (ex.: `nfce.emit`,
 * `finance.entry_create`, `stock.adjust`) para facilitar filtros na trilha.
 */
export async function logActivity(
  session: Actor,
  action: string,
  detail: string,
  targetId?: string,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: session.org,
        actorId: session.sub,
        actorName: session.name,
        action,
        detail,
        targetId: targetId ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] falha ao registrar atividade:", e);
  }
}
