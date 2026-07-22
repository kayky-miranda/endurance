/** Skeleton das áreas de conta/organização (coluna única de cartões). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-ink-800" />
        <div className="h-4 w-72 max-w-full rounded-lg bg-slate-100 dark:bg-ink-800/60" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-44 rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900"
        />
      ))}
    </div>
  );
}
