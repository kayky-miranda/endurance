"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileStack,
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { TEMPLATE_TYPES } from "@/lib/endurance/doc-template";
import type { TemplateRow } from "@/lib/endurance/document-templates";
import { saveTemplateAction, deleteTemplateAction } from "./templates-actions";

export default function TemplatesManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function remove(id: string) {
    if (!confirm("Remover este modelo?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteTemplateAction(id);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FileStack className="h-4 w-4 text-brand-500" /> Modelos de documentos
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-ink-800">
            {templates.length}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-ink-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Textos reutilizáveis para acelerar anotações, receitas e atestados.
            </p>
            {editing === null && (
              <button
                onClick={() => {
                  setError("");
                  setEditing("new");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400"
              >
                <Plus className="h-3.5 w-3.5" /> Novo modelo
              </button>
            )}
          </div>

          {error && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          {editing !== null ? (
            <TemplateEditor
              template={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : templates.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">Nenhum modelo ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-ink-800">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                    {t.typeLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</p>
                    <p className="truncate text-xs text-slate-400">{t.content}</p>
                  </div>
                  {pendingId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <button onClick={() => { setError(""); setEditing(t); }} aria-label="Editar modelo" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(t.id)} aria-label="Remover modelo" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: TemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [type, setType] = useState(template?.type ?? "nota");
  const [title, setTitle] = useState(template?.title ?? "");
  const [content, setContent] = useState(template?.content ?? "");

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveTemplateAction({ id: template?.id, type, title, content });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {template ? "Editar modelo" : "Novo modelo"}
        </span>
        <button onClick={onClose} aria-label="Fechar" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block text-xs font-medium text-slate-500">
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Evolução padrão" className={inputCls} />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-500">
        Conteúdo
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
      </label>
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">cancelar</button>
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
        </button>
      </div>
    </div>
  );
}
