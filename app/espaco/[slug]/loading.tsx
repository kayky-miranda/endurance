/** Skeleton do espaço — imita o layout padrão (header + KPIs + painel). */
export default function EspacoLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-ink-800" />
        <div className="h-4 w-80 rounded-lg bg-slate-100 dark:bg-ink-800/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900"
          />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900" />
    </div>
  );
}
