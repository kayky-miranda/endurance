"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  User,
  Clock,
  X,
} from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import type { ClinicalNoteRow } from "@/lib/endurance/prontuario";
import type { TemplateRow } from "@/lib/endurance/document-templates";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "../prontuario-actions";

/** Timeline do prontuário + editor de anotações (criar/editar/excluir). */
export default function RecordClient({
  slug,
  customerId,
  notes,
  templates = [],
}: {
  slug: string;
  customerId: string;
  notes: ClinicalNoteRow[];
  templates?: TemplateRow[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<ClinicalNoteRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function remove(note: ClinicalNoteRow) {
    if (!confirm("Remover esta anotação do prontuário? Ela sai da visualização, mas o registro é preservado por retenção clínica.")) return;
    setError("");
    setPendingId(note.id);
    startTransition(async () => {
      const res = await deleteNoteAction({ id: note.id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Anotações clínicas
        </h2>
        <button
          onClick={() => {
            setError("");
            setCreating(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova anotação
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma anotação ainda. Registre a evolução, condutas e queixas do
            paciente.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {n.title && (
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {n.title}
                    </p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmt(n.createdAt)}
                    </span>
                    {n.authorName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> {n.authorName}
                      </span>
                    )}
                    {n.edited && <span className="italic">editada</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {pendingId === n.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setError("");
                          setEditing(n);
                        }}
                        aria-label="Editar anotação"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(n)}
                        aria-label="Remover anotação"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {n.content}
              </p>
            </li>
          ))}
        </ol>
      )}

      {(creating || editing) && (
        <NoteModal
          customerId={customerId}
          note={editing}
          templates={templates}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NoteModal({
  customerId,
  note,
  templates,
  onClose,
  onSaved,
}: {
  customerId: string;
  note: ClinicalNoteRow | null;
  templates: TemplateRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");

  function insertTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setContent((prev) => (prev.trim() ? `${prev}\n\n${t.content}` : t.content));
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const res = note
        ? await updateNoteAction({ id: note.id, customerId, title, content })
        : await createNoteAction({ customerId, title, content });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="note-modal-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            {note ? "Editar anotação" : "Nova anotação"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <label className="block text-xs font-medium text-slate-500">
            Título (opcional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Retorno, Avaliação inicial…"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            <span className="flex items-center justify-between gap-2">
              Anotação
              {templates.length > 0 && (
                <select
                  aria-label="Inserir modelo"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertTemplate(e.target.value);
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-normal dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                >
                  <option value="">+ inserir modelo</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )}
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Evolução, conduta, queixas, orientações…"
              className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {note ? "Salvar" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
