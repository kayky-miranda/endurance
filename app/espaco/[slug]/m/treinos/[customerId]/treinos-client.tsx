"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  X,
} from "lucide-react";
import { DEFAULT_GROUPS } from "@/lib/endurance/workout";
import type { WorkoutFull } from "@/lib/endurance/treinos";
import {
  saveWorkoutAction,
  setWorkoutActiveAction,
  deleteWorkoutAction,
} from "../treinos-actions";

interface EditorRow {
  key: string;
  group: string;
  exercise: string;
  sets: string;
  load: string;
  rest: string;
  notes: string;
}

let seq = 0;
const mkRow = (group = "A"): EditorRow => ({
  key: `w${seq++}`,
  group,
  exercise: "",
  sets: "",
  load: "",
  rest: "",
  notes: "",
});

function toRows(w: WorkoutFull): EditorRow[] {
  const rows: EditorRow[] = [];
  for (const g of w.groups)
    for (const it of g.items)
      rows.push({
        key: `w${seq++}`,
        group: g.group,
        exercise: it.exercise,
        sets: it.sets,
        load: it.load,
        rest: it.rest,
        notes: it.notes,
      });
  return rows.length ? rows : [mkRow()];
}

export default function TreinosClient({
  slug,
  customerId,
  workouts,
}: {
  slug: string;
  customerId: string;
  workouts: WorkoutFull[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editorFor, setEditorFor] = useState<WorkoutFull | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function quick(fn: () => Promise<{ ok: boolean; error?: string }>, id: string) {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Falha.");
    });
  }

  if (editorFor) {
    return (
      <WorkoutEditor
        customerId={customerId}
        workout={editorFor === "new" ? null : editorFor}
        onClose={() => setEditorFor(null)}
        onSaved={() => {
          setEditorFor(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Fichas do aluno
        </h2>
        <button
          onClick={() => {
            setError("");
            setEditorFor("new");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova ficha
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {workouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma ficha ainda. Clique em <strong>Nova ficha</strong> para montar
            o treino.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workouts.map((w) => (
            <article
              key={w.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {w.title}
                    {w.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> ativa
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                        arquivada
                      </span>
                    )}
                  </p>
                  {w.goal && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{w.goal}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {pendingId === w.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setError("");
                          setEditorFor(w);
                        }}
                        aria-label="Editar ficha"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          quick(
                            () => setWorkoutActiveAction({ id: w.id, customerId, active: !w.active }),
                            w.id,
                          )
                        }
                        aria-label={w.active ? "Arquivar ficha" : "Ativar ficha"}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        {w.active ? <Archive className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Remover esta ficha? O histórico é preservado.")) return;
                          quick(() => deleteWorkoutAction({ id: w.id, customerId }), w.id);
                        }}
                        aria-label="Remover ficha"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {w.groups.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
                      Treino {g.group}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {g.items.map((it, i) => (
                            <tr key={i} className="border-b border-slate-50 last:border-0 dark:border-ink-800">
                              <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200">
                                {it.exercise}
                              </td>
                              <td className="py-1.5 pr-3 text-slate-500">{it.sets}</td>
                              <td className="py-1.5 pr-3 text-slate-500">{it.load}</td>
                              <td className="py-1.5 pr-3 text-slate-400">{it.rest}</td>
                              <td className="py-1.5 text-xs text-slate-400">{it.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutEditor({
  customerId,
  workout,
  onClose,
  onSaved,
}: {
  customerId: string;
  workout: WorkoutFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState(workout?.title ?? "");
  const [goal, setGoal] = useState(workout?.goal ?? "");
  const [rows, setRows] = useState<EditorRow[]>(workout ? toRows(workout) : [mkRow()]);

  const update = (key: string, patch: Partial<EditorRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const addRow = () => setRows((prev) => [...prev, mkRow(prev[prev.length - 1]?.group)]);

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveWorkoutAction({
        id: workout?.id,
        customerId,
        title,
        goal,
        items: rows.map((r) => ({
          group: r.group,
          exercise: r.exercise,
          sets: r.sets,
          load: r.load,
          rest: r.rest,
          notes: r.notes,
        })),
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  const inputCls =
    "rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {workout ? "Editar ficha" : "Nova ficha"}
        </h2>
        <button
          onClick={onClose}
          aria-label="Fechar editor"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Treino ABC hipertrofia"
            className={`mt-1 w-full ${inputCls}`}
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Objetivo
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex.: Ganho de massa"
            className={`mt-1 w-full ${inputCls}`}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <div className="hidden gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[4rem_1fr_5rem_5rem_5rem_2rem]">
          <span>Divisão</span>
          <span>Exercício</span>
          <span>Séries</span>
          <span>Carga</span>
          <span>Descanso</span>
          <span />
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[4rem_1fr_5rem_5rem_5rem_2rem] sm:items-center"
            >
              <input
                value={r.group}
                onChange={(e) => update(r.key, { group: e.target.value.toUpperCase() })}
                list="workout-groups"
                aria-label="Divisão"
                className={inputCls}
              />
              <input
                value={r.exercise}
                onChange={(e) => update(r.key, { exercise: e.target.value })}
                placeholder="Exercício"
                aria-label="Exercício"
                className={inputCls}
              />
              <input
                value={r.sets}
                onChange={(e) => update(r.key, { sets: e.target.value })}
                placeholder="4x12"
                aria-label="Séries"
                className={inputCls}
              />
              <input
                value={r.load}
                onChange={(e) => update(r.key, { load: e.target.value })}
                placeholder="20kg"
                aria-label="Carga"
                className={inputCls}
              />
              <input
                value={r.rest}
                onChange={(e) => update(r.key, { rest: e.target.value })}
                placeholder="60s"
                aria-label="Descanso"
                className={inputCls}
              />
              <button
                onClick={() => removeRow(r.key)}
                disabled={rows.length === 1}
                aria-label="Remover exercício"
                className="grid h-8 w-8 place-items-center justify-self-start rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <datalist id="workout-groups">
          {DEFAULT_GROUPS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar exercício
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
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
          {workout ? "Salvar ficha" : "Criar ficha"}
        </button>
      </div>
    </div>
  );
}
