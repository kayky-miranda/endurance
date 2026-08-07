/** Skeleton da trilha de auditoria (filtros + tabela). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-ink-800" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-slate-100 dark:bg-ink-800/60" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[220, 140, 140, 130].map((w) => (
          <div
            key={w}
            style={{ width: w }}
            className="h-10 max-w-full rounded-xl bg-slate-100 dark:bg-ink-800/60"
          />
        ))}
      </div>
      <div className="h-96 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900" />
    </div>
  );
}
