"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReceiptActions({ slug }: { slug: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[360px] items-center justify-between print:hidden">
      <Link
        href={`/espaco/${slug}/m/pdv`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao caixa
      </Link>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>
    </div>
  );
}
