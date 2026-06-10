"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EtiquetasPrint({ backHref }: { backHref: string }) {
  return (
    <div className="mb-4 flex items-center justify-between print:hidden">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>
    </div>
  );
}
