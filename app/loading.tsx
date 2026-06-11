/** Loading da raiz (landing, onboarding, login). */
export default function RootLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink-700 border-t-brand-500" />
        <p className="text-sm text-slate-500">Carregando…</p>
      </div>
    </div>
  );
}
