"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@/lib/endurance/pagination";

const btnCls =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:pointer-events-none disabled:opacity-40 dark:border-ink-600 dark:text-slate-300";

/**
 * Controle de paginação das listas dos módulos. A página vive na URL (`param`),
 * então a busca roda no servidor — cada tela só carrega a página atual.
 * `param` distinto por lista permite duas tabelas paginadas na mesma tela.
 */
export default function Pager({
  param,
  meta,
}: {
  param: string;
  meta: PageMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  if (meta.pageCount <= 1) return null;

  function go(page: number) {
    const params = new URLSearchParams(search.toString());
    if (page <= 1) params.delete(param);
    else params.set(param, String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Página {meta.page} de {meta.pageCount} · {meta.total}{" "}
        {meta.total === 1 ? "registro" : "registros"}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => go(meta.page - 1)}
          disabled={meta.page <= 1}
          className={btnCls}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </button>
        <button
          onClick={() => go(meta.page + 1)}
          disabled={meta.page >= meta.pageCount}
          className={btnCls}
        >
          Próxima
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
