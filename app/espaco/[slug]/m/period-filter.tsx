"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { PERIODS } from "@/lib/endurance/period";

/**
 * Seletor de período dos painéis (?dias=7|30|90|365).
 *
 * Estado na URL, como a busca, a ordenação e a paginação: o recorte roda no
 * banco, o link é compartilhável ("manda o painel de 90 dias pro contador")
 * e o botão Voltar funciona.
 */

// ATENÇÃO: este módulo é "use client" e NÃO reexporta parsePeriod/PERIODS.
// Server Component que importasse daqui receberia uma referência de cliente
// no lugar do valor. O parse mora em lib/endurance/period.ts — importe de lá.

export function PeriodFilter({ days }: { days: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(value: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 30) params.delete("dias");
    else params.set("dias", String(value));
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Período do painel"
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-ink-700 dark:bg-ink-900"
    >
      <CalendarRange className="ml-1.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      {PERIODS.map((p) => (
        <button
          key={p.days}
          onClick={() => pick(p.days)}
          aria-pressed={days === p.days}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            days === p.days
              ? "bg-brand-500 text-ink-950"
              : "text-slate-500 hover:text-brand-500 dark:text-slate-400"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
