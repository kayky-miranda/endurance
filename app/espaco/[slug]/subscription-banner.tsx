import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { PlanContext } from "@/lib/endurance/plan-limits";

/**
 * Aviso fixo quando a assinatura não está em dia.
 *
 * Existe porque o bloqueio passou a ser real: com o teste encerrado ou a
 * assinatura vencida, `requirePermission` recusa toda mutação. Sem este aviso o
 * usuário descobriria isso batendo em erro na primeira ação — o pior jeito de
 * comunicar uma cobrança. Aqui ele lê a causa e o caminho antes de tentar.
 *
 * Não é dispensável de propósito (diferente do aviso de e-mail): é a condição
 * de uso do sistema, não um lembrete.
 */
export default function SubscriptionBanner({
  slug,
  ctx,
  canManageBilling,
}: {
  slug: string;
  ctx: PlanContext;
  canManageBilling: boolean;
}) {
  const message = messageFor(ctx);
  if (!message) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong>{message.title}</strong>{" "}
        <span className="opacity-80">{message.detail}</span>
      </span>
      {canManageBilling ? (
        <Link
          href={`/espaco/${slug}/assinatura`}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
        >
          {message.cta}
        </Link>
      ) : (
        // Quem não cuida da cobrança não tem o que fazer com um botão — precisa
        // saber a quem recorrer.
        <span className="text-xs opacity-80">
          Fale com o responsável pela conta.
        </span>
      )}
    </div>
  );
}

function messageFor(
  ctx: PlanContext,
): { title: string; detail: string; cta: string } | null {
  if (ctx.legacyFullAccess) return null;

  if (ctx.status === "canceled")
    return {
      title: "Assinatura cancelada.",
      detail:
        "Seus dados continuam aqui e podem ser consultados e exportados. Para voltar a registrar, reative um plano.",
      cta: "Reativar plano",
    };

  if (ctx.status === "past_due" || ctx.trialExpired)
    return {
      title: ctx.trialExpired
        ? "Seu período de teste terminou."
        : "Pagamento pendente.",
      detail:
        "A consulta e a exportação seguem liberadas; novos registros ficam bloqueados até a regularização.",
      cta: "Escolher plano",
    };

  return null;
}
