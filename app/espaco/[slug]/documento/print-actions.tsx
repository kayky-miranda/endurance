"use client";

import { Printer, ArrowLeft } from "lucide-react";

export default function PrintActions({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[640px] items-center justify-between print:hidden">
      <a
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </a>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
      >
        <Printer className="h-4 w-4" /> Imprimir
      </button>
    </div>
  );
}
