"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Boundary de erro do espaço — renderiza dentro do shell (sidebar preservada). */
export default function EspacoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ slug: string }>();

  useEffect(() => {
    console.error("[error-boundary:espaco]", error);
  }, [error]);

  return (
    <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Não conseguimos carregar esta tela
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Seus dados estão seguros — foi um erro ao montar a página. Tente
          novamente.
          {error.digest && (
            <span className="mt-1 block text-xs text-slate-400 dark:text-slate-600">
              Código: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <RotateCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <Link
            href={`/espaco/${params.slug}`}
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  );
}
