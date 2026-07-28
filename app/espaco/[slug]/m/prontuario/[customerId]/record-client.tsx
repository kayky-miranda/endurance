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
  Sparkles,
  SpellCheck,
  Undo2,
} from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import type { ClinicalNoteRow } from "@/lib/endurance/prontuario";
import type { TemplateRow } from "@/lib/endurance/document-templates";
import { suggestCidFromText, type CidCode } from "@/lib/endurance/cid";
import { CidPicker } from "./prescriptions-panel";
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  summarizeRecordAction,
  suggestConductAction,
  proofreadNoteAction,
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
  const [summarizing, startSummary] = useTransition();
  const [summary, setSummary] = useState<{ text: string; source: "ai" | "heuristic" } | null>(null);

  function summarize() {
    setError("");
    startSummary(async () => {
      const res = await summarizeRecordAction(customerId);
      if (res.ok) setSummary({ text: res.text, source: res.source });
      else setError(res.error);
    });
  }

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
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <button
              onClick={summarize}
              disabled={summarizing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
            >
              {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Resumo com IA
            </button>
          )}
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
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {summary && (
        <div className="rounded-2xl border border-brand-200 bg-brand-500/5 p-4 dark:border-brand-500/20">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> Resumo do prontuário
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                {summary.source === "ai" ? "IA" : "automático"}
              </span>
            </span>
            <button onClick={() => setSummary(null)} aria-label="Fechar resumo" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{summary.text}</p>
          <p className="mt-2 text-[11px] text-slate-400">
            Resumo gerado a partir das anotações — confira antes de usar em documento.
          </p>
        </div>
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
                    {n.cid && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-1.5 py-0.5 font-medium text-brand-600 dark:text-brand-300"
                        title={n.cidDescription}
                      >
                        CID {n.cid}
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
  const [cid, setCid] = useState(note?.cid ?? "");
  const [cidDescription, setCidDescription] = useState(note?.cidDescription ?? "");
  const [suggestions, setSuggestions] = useState<CidCode[]>([]);
  const [conductBusy, startConduct] = useTransition();
  const [conduct, setConduct] = useState<{ text: string; source: "ai" | "unavailable" } | null>(null);
  const [proofBusy, startProof] = useTransition();
  const [proof, setProof] = useState<
    { source: "ai" | "unchanged" | "unavailable"; previous?: string } | null
  >(null);

  function insertTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setContent((prev) => (prev.trim() ? `${prev}\n\n${t.content}` : t.content));
  }

  function suggestCid() {
    setSuggestions(suggestCidFromText(`${title} ${content}`));
  }

  function askConduct() {
    startConduct(async () => {
      const res = await suggestConductAction({ text: `${title}\n${content}`.trim(), cid, cidDescription });
      if (res.ok) setConduct({ text: res.text, source: res.source });
    });
  }

  function proofread() {
    if (!content.trim()) return;
    setError("");
    startProof(async () => {
      const res = await proofreadNoteAction(content);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.source === "ai") {
        setProof({ source: "ai", previous: content });
        setContent(res.text);
      } else {
        setProof({ source: res.source });
      }
    });
  }

  function undoProof() {
    if (proof?.previous !== undefined) setContent(proof.previous);
    setProof(null);
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const res = note
        ? await updateNoteAction({ id: note.id, customerId, title, content, cid, cidDescription })
        : await createNoteAction({ customerId, title, content, cid, cidDescription });
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
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={proofread}
                  disabled={proofBusy || !content.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-normal text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-300"
                >
                  {proofBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <SpellCheck className="h-3 w-3" />
                  )}
                  Corrigir texto
                </button>
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
            </span>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (proof) setProof(null);
              }}
              rows={8}
              placeholder="Evolução, conduta, queixas, orientações…"
              className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            {proof && (
              <span className="mt-1 flex items-center gap-2 text-[11px] font-normal">
                {proof.source === "ai" ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <SpellCheck className="h-3 w-3" /> Texto corrigido pela IA — revise antes de salvar.
                    </span>
                    <button
                      type="button"
                      onClick={undoProof}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-500 dark:text-slate-400"
                    >
                      <Undo2 className="h-3 w-3" /> desfazer
                    </button>
                  </>
                ) : proof.source === "unchanged" ? (
                  <span className="text-slate-400">Nenhuma correção necessária.</span>
                ) : (
                  <span className="text-slate-400">
                    A correção com IA precisa de uma chave (GEMINI_API_KEY) configurada.
                  </span>
                )}
              </span>
            )}
          </label>

          {/* CID + sugestão automática a partir do texto */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <CidPicker code={cid} description={cidDescription} onPick={(c, d) => { setCid(c); setCidDescription(d); }} />
              </div>
              <button
                type="button"
                onClick={suggestCid}
                className="mb-0.5 shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
              >
                Sugerir do texto
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setCid(c.code);
                      setCidDescription(c.description);
                      setSuggestions([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-300"
                    title={c.description}
                  >
                    <span className="font-semibold text-brand-600 dark:text-brand-300">{c.code}</span>
                    <span className="max-w-[10rem] truncate">{c.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Apoio à decisão (IA opcional) */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-ink-700">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Apoio à decisão
              </span>
              <button
                type="button"
                onClick={askConduct}
                disabled={conductBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
              >
                {conductBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Sugerir conduta / exames
              </button>
            </div>
            {conduct && (
              conduct.source === "unavailable" ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  Sugestões com IA precisam de uma chave (GEMINI_API_KEY) configurada.
                </p>
              ) : (
                <div className="mt-2">
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{conduct.text}</p>
                  <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    Sugestão gerada por IA — apoio à decisão, não substitui o julgamento do profissional.
                  </p>
                </div>
              )
            )}
          </div>

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
