/** Skeleton de módulo — header + grade de KPIs + dois painéis. */
export default function ModuleLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg bg-slate-200 dark:bg-ink-800" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-slate-100 dark:bg-ink-800/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900" />
        <div className="h-64 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900" />
      </div>
    </div>
  );
}
