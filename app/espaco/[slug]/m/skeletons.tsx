/**
 * Kit de skeletons dos módulos.
 *
 * Cada rota de módulo tem um `loading.tsx` que escolhe a variante com a MESMA
 * silhueta da tela real (cabeçalho, KPIs, tabela…). O objetivo é que a troca
 * do skeleton pelo conteúdo não desloque nada na tela — nada de tela branca
 * nem de "pulo" de layout quando os dados chegam.
 */

const CARD =
  "rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900";
const BAR = "rounded-lg bg-slate-200 dark:bg-ink-800";
const BAR_SOFT = "rounded-lg bg-slate-100 dark:bg-ink-800/60";

/** Cabeçalho do módulo: link de volta, título e descrição. */
function HeaderBlock() {
  return (
    <div className="space-y-2">
      <div className={`h-4 w-28 ${BAR_SOFT}`} />
      <div className={`h-7 w-64 max-w-full ${BAR}`} />
      <div className={`h-4 w-96 max-w-full ${BAR_SOFT}`} />
    </div>
  );
}

function KpiRow({ count = 4 }: { count?: number }) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${count >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-28 ${CARD}`} />
      ))}
    </div>
  );
}

function TableBlock({ rows = 8, toolbar = false }: { rows?: number; toolbar?: boolean }) {
  return (
    <div className="space-y-3">
      {toolbar && <div className={`h-11 w-full ${CARD}`} />}
      <div className={`overflow-hidden ${CARD}`}>
        <div className="border-b border-slate-100 px-5 py-3 dark:border-ink-800">
          <div className={`h-3.5 w-40 ${BAR_SOFT}`} />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 dark:border-ink-800/60"
          >
            <div className={`h-4 flex-1 ${BAR_SOFT}`} />
            <div className={`hidden h-4 w-24 sm:block ${BAR_SOFT}`} />
            <div className={`hidden h-4 w-20 md:block ${BAR_SOFT}`} />
            <div className={`h-4 w-16 ${BAR_SOFT}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista simples (KPIs + tabela) — a silhueta mais comum dos módulos. */
export function ListModuleSkeleton({
  kpis = 4,
  rows = 8,
  toolbar = true,
}: {
  kpis?: number;
  rows?: number;
  toolbar?: boolean;
}) {
  return (
    <div className="animate-pulse space-y-6">
      <HeaderBlock />
      {kpis > 0 && <KpiRow count={kpis} />}
      <TableBlock rows={rows} toolbar={toolbar} />
    </div>
  );
}

/** Painel analítico: KPIs + blocos de gráfico. */
export function DashboardModuleSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <HeaderBlock />
      <KpiRow count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`h-72 ${CARD}`} />
        <div className={`h-72 ${CARD}`} />
      </div>
      <div className={`h-64 ${CARD}`} />
    </div>
  );
}

/** Formulário/painel de ação no topo + lista abaixo. */
export function FormModuleSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      <HeaderBlock />
      <div className={`p-5 ${CARD}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-11 ${BAR_SOFT}`} />
          ))}
        </div>
        <div className={`mt-4 h-10 w-44 ${BAR}`} />
      </div>
      <TableBlock rows={rows} />
    </div>
  );
}

/** PDV: catálogo à esquerda, carrinho à direita. */
export function PdvSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <HeaderBlock />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className={`h-12 ${CARD}`} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-24 ${CARD}`} />
            ))}
          </div>
        </div>
        <div className={`h-[28rem] ${CARD}`} />
      </div>
    </div>
  );
}

/** Cartões (marketing, notificações, integrações). */
export function CardsModuleSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      <HeaderBlock />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`h-40 ${CARD}`} />
        ))}
      </div>
    </div>
  );
}
