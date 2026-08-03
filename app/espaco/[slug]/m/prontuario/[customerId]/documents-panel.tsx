"use client";

import { useState } from "react";
import { Printer, FileText, Layers, X } from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import { DOCUMENTS, type DocumentType } from "@/lib/endurance/document-catalog";

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

function BatchModal({
  slug,
  customerId,
  available,
  onClose,
}: {
  slug: string;
  customerId: string;
  available: DocumentType[];
  onClose: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [selected, setSelected] = useState<Set<DocumentType>>(new Set());
  const docs = DOCUMENTS.filter((d) => available.includes(d.id));

  function toggle(id: DocumentType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const url = `/espaco/${slug}/documento/lote/${customerId}?docs=${[...selected].join(",")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lote-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="lote-title" className="text-base font-bold text-slate-900 dark:text-white">
            Imprimir em lote
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Os documentos escolhidos saem em sequência, cada um em sua folha, num
          único arquivo.
        </p>

        <div className="space-y-1.5">
          {docs.map((d) => (
            <label
              key={d.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-2.5 transition hover:border-brand-400 dark:border-ink-700"
            >
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-800 dark:text-slate-100">
                  {d.label}
                </span>
                <span className="block text-[11px] text-slate-400">{d.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancelar
          </button>
          <a
            href={selected.size > 0 ? url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={selected.size === 0}
            onClick={(e) => {
              if (selected.size === 0) e.preventDefault();
              else onClose();
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${
              selected.size > 0
                ? "bg-brand-500 text-ink-950 hover:bg-brand-400"
                : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-ink-800"
            }`}
          >
            <Printer className="h-4 w-4" />
            Gerar {selected.size > 0 ? `(${selected.size})` : ""}
          </a>
        </div>
      </div>
    </div>
  );
}
