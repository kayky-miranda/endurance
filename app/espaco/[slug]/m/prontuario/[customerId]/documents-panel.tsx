"use client";

import { useState } from "react";
import { Printer, FileText, Layers } from "lucide-react";
import { DOCUMENTS, type DocumentType } from "@/lib/endurance/document-catalog";
import { BatchModal } from "../../../components/PrintMenu";

/**
 * Documentos do paciente: impressão individual (um clique) ou em LOTE (vários
 * documentos numa só passada, cada um em sua folha).
 *
 * O lote monta `?docs=a,b,c` e abre a mesma rota de impressão — o navegador
 * gera um único PDF a partir de uma única página, sem precisar de um motor de
 * PDF no servidor.
 */
export default function DocumentsPanel({
  slug,
  customerId,
  /** Ids liberados pelo perfil — calculado no servidor. */
  available,
}: {
  slug: string;
  customerId: string;
  available: DocumentType[];
}) {
  const [batchOpen, setBatchOpen] = useState(false);
  const docs = DOCUMENTS.filter((d) => available.includes(d.id));
  if (docs.length === 0) return null;

  const href = (tipo: string) => `/espaco/${slug}/documento/${tipo}/${customerId}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Printer className="h-4 w-4 text-brand-500" /> Documentos
        </h2>
        <button
          onClick={() => setBatchOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
        >
          <Layers className="h-3.5 w-3.5" /> Imprimir em lote
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <a
            key={d.id}
            href={href(d.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 transition hover:border-brand-500 hover:bg-brand-500/5 dark:border-ink-700"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                {d.label}
              </span>
              <span className="block text-[11px] text-slate-400">{d.description}</span>
            </span>
          </a>
        ))}
      </div>

      {batchOpen && (
        <BatchModal
          slug={slug}
          customerId={customerId}
          available={available}
          onClose={() => setBatchOpen(false)}
        />
      )}
    </section>
  );
}
