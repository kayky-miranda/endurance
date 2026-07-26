"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react";
import { ATTACHMENT_CATEGORIES } from "@/lib/endurance/patient";
import type { PatientAttachmentRow } from "@/lib/endurance/pacientes";
import { addAttachmentAction, deleteAttachmentAction } from "../pacientes-actions";

const CAT_LABEL = Object.fromEntries(
  ATTACHMENT_CATEGORIES.map((c) => [c.value, c.label]),
);

export default function AttachmentsPanel({
  slug: _slug,
  customerId,
  attachments,
}: {
  slug: string;
  customerId: string;
  attachments: PatientAttachmentRow[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", category: "documento", url: "", notes: "" });

  function add() {
    setError("");
    startTransition(async () => {
      const res = await addAttachmentAction({ customerId, ...form });
      if (res.ok) {
        setForm({ name: "", category: "documento", url: "", notes: "" });
        setAdding(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Remover este anexo?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteAttachmentAction({ id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Paperclip className="h-4 w-4 text-brand-500" /> Documentos e anexos
        </h2>
        {!adding && (
          <button
            onClick={() => {
              setError("");
              setAdding(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400"
          >
            <Plus className="h-3.5 w-3.5" /> Anexar link
          </button>
        )}
      </div>

      <p className="mb-3 text-[11px] text-slate-400">
        Os anexos são guardados como links (Google Drive, OneDrive, etc.). O
        upload de arquivos direto entra quando o armazenamento for configurado.
      </p>

      {adding && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do documento"
              aria-label="Nome do anexo"
              className={inputCls}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              aria-label="Categoria"
              className={inputCls}
            >
              {ATTACHMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://link-do-arquivo…"
            aria-label="Link do anexo"
            className={inputCls}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" /> cancelar
            </button>
            <button
              onClick={add}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nenhum anexo ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-ink-800">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                {CAT_LABEL[a.category] ?? a.category}
              </span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                <span className="truncate">{a.name}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {new Date(a.createdAt).toLocaleDateString("pt-BR")}
              </span>
              {pendingId === a.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <button
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  aria-label="Remover anexo"
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
