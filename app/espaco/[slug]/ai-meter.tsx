import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getAiBalance } from "@/lib/endurance/ai-credits";

/**
 * Medidor de créditos de IA no topbar.
 *
 * Limite invisível vira chamado de suporte ("por que parou de funcionar?");
 * limite visível vira upgrade. Por isso o saldo aparece o tempo todo, e não só
 * na hora do bloqueio — o cliente acompanha o consumo e decide antes de travar.
 *
 * Some para quem tem plano sem teto: mostrar "∞" só ocuparia espaço.
 */
export default async function AiMeter({
  slug,
  orgId,
}: {
  slug: string;
  orgId: string;
}) {
  const balance = await getAiBalance(orgId);
  if (balance.unlimited || balance.included <= 0) return null;

  const pct = Math.min(100, Math.round((balance.used / balance.included) * 100));
  const low = balance.remaining <= Math.max(3, balance.included * 0.1);
  const empty = balance.remaining <= 0;

  const tone = empty
    ? "text-rose-600 dark:text-rose-400"
    : low
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-500 dark:text-slate-400";
  const barTone = empty ? "bg-rose-500" : low ? "bg-amber-500" : "bg-brand-500";

  return (
    <Link
      href={`/espaco/${slug}/assinatura`}
      title={`${balance.remaining} de ${balance.included} créditos de IA restantes neste ciclo. Renova em ${balance.resetsAt.toLocaleDateString("pt-BR")}.`}
      className="hidden items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 transition hover:border-brand-500 dark:border-ink-700 md:flex"
    >
      <Sparkles className={`h-3.5 w-3.5 ${tone}`} />
      <span className="flex flex-col gap-1">
        <span className={`text-[11px] font-medium leading-none ${tone}`}>
          {empty ? "IA sem créditos" : `${balance.remaining} créditos`}
        </span>
        <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800">
          <span
            className={`block h-full rounded-full ${barTone}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </Link>
  );
}
