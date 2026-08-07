"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Layers, X, ChevronDown } from "lucide-react";
import { useModalA11y } from "../use-modal-a11y";
import { DOCUMENTS, type DocumentType } from "@/lib/endurance/document-catalog";

/**
 * Ponto de entrada de impressão para qualquer tela que trabalhe sobre um
 * paciente. Fica no cabeçalho, ao lado do título.
 *
 * Por que um menu e não o painel do prontuário: o prontuário é a tela onde
 * escolher documento É a tarefa, e ali o painel em grade faz sentido. Nas
 * demais (anamnese, evolução, ficha, avaliação) imprimir é uma ação de apoio —
 * repetir um bloco grande em todas roubaria a atenção do trabalho principal e
 * empurraria o conteúdo para baixo da dobra.
 *
 * O documento do próprio módulo vem primeiro e destacado: quem está na anamnese
 * quase sempre quer imprimir a anamnese. Os outros ficam logo abaixo, porque
 * negar o atalho obrigaria a voltar ao prontuário só para imprimir.
 */
export default function PrintMenu({
  slug,
  customerId,
  available,
  /** Módulo da tela — seus documentos sobem para o topo da lista. */
  ownerModule,
  label = "Imprimir",
}: {
  slug: string;
  customerId: string;
  available: DocumentType[];
  ownerModule?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou no Esc — um menu preso aberto tapa o conteúdo.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const docs = orderDocs(available, ownerModule);
  if (docs.length === 0) return null;

  const own = ownerModule
    ? docs.filter((d) => d.module === ownerModule).length
    : 0;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-300"
      >
        <Printer className="h-4 w-4" /> {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-ink-700 dark:bg-ink-900"
        >
          {docs.map((d, i) => (
            <div key={d.id}>
              {own > 0 && i === own && (
                <div className="my-1 border-t border-slate-100 dark:border-ink-800" />
              )}
              <a
                role="menuitem"
                href={`/espaco/${slug}/documento/${d.id}/${customerId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 transition hover:bg-brand-500/10"
              >
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {d.label}
                </span>
                <span className="block text-[11px] text-slate-400">
                  {d.description}
                </span>
              </a>
            </div>
          ))}

          {docs.length > 1 && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-ink-800" />
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setBatchOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-brand-500/10 dark:text-slate-300"
              >
                <Layers className="h-4 w-4" /> Imprimir em lote…
              </button>
            </>
          )}
        </div>
      )}

      {batchOpen && (
        <BatchModal
          slug={slug}
          customerId={customerId}
          available={available}
          onClose={() => setBatchOpen(false)}
        />
      )}
    </div>
  );
}

/** Ordem: documentos do próprio módulo primeiro, depois a ordem do catálogo. */
function orderDocs(available: DocumentType[], ownerModule?: string) {
  const list = DOCUMENTS.filter((d) => available.includes(d.id));
  if (!ownerModule) return list;
  return [
    ...list.filter((d) => d.module === ownerModule),
    ...list.filter((d) => d.module !== ownerModule),
  ];
}

/**
 * Seleção de vários documentos numa só impressão. Monta `?docs=a,b,c` e abre a
 * rota de impressão — o navegador gera um único arquivo a partir de uma única
 * página, sem motor de PDF no servidor.
 */
export function BatchModal({
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
          <h2
            id="lote-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
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
                <span className="block text-[11px] text-slate-400">
                  {d.description}
                </span>
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
