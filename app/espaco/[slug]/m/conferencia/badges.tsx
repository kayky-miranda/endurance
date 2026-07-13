import {
  COUNT_STATUS_LABEL,
  COUNT_TYPE_LABEL,
} from "@/lib/endurance/stock-count-shared";

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  em_conferencia: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  aguardando_aprovacao: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  aprovada: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  ajustada: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  cancelada: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

export function CountStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLE[status] ?? STATUS_STYLE.rascunho
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {COUNT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function CountTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:border-ink-600 dark:text-slate-300">
      {COUNT_TYPE_LABEL[type] ?? type}
    </span>
  );
}
