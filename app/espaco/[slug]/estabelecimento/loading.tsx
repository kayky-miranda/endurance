/** Skeleton do assistente: navegação das etapas + formulário. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-ink-800" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-slate-100 dark:bg-ink-800/60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-ink-800/60" />
          ))}
        </div>
        <div className="h-[520px] rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900" />
      </div>
    </div>
  );
}
