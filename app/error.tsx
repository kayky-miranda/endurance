"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Boundary de erro da raiz (landing, onboarding, login). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary:root]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-100">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Encontramos um erro inesperado. Tente novamente — se persistir, fale
          com o suporte.
          {error.digest && (
            <span className="mt-1 block text-xs text-slate-600">
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
            href="/"
            className="inline-flex items-center rounded-xl border border-ink-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-ink-900"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
