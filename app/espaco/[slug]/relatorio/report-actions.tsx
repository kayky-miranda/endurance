"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReportActions({
  slug,
  backTo = "relatorios",
  backLabel = "Voltar ao painel",
}: {
  slug: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[760px] items-center justify-between print:hidden">
      <Link
        href={`/espaco/${slug}/m/${backTo}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600"
      >
        <Printer className="h-4 w-4" />
        Exportar / Imprimir PDF
      </button>
    </div>
  );
}
