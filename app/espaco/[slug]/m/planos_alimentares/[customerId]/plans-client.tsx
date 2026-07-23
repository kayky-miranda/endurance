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
import { MEAL_SECTIONS } from "@/lib/endurance/meal-plan";
import type { MealPlanFull } from "@/lib/endurance/planos";
import {
  savePlanAction,
  setPlanActiveAction,
  deletePlanAction,
} from "../planos-actions";

interface EditorRow {
  key: string;
  meal: string;
  food: string;
  amount: string;
  notes: string;
}

let rowSeq = 0;
const newRow = (meal = MEAL_SECTIONS[0].meal): EditorRow => ({
  key: `r${rowSeq++}`,
  meal,
  food: "",
  amount: "",
  notes: "",
});

function planToRows(plan: MealPlanFull): EditorRow[] {
  const rows: EditorRow[] = [];
  for (const m of plan.meals)
    for (const it of m.items)
      rows.push({ key: `r${rowSeq++}`, meal: m.meal, food: it.food, amount: it.amount, notes: it.notes });
  return rows.length ? rows : [newRow()];
}

export default function PlansClient({
  slug,
  customerId,
  plans,
}: {
  slug: string;
  customerId: string;
  plans: MealPlanFull[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editorFor, setEditorFor] = useState<MealPlanFull | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function quickAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    id: string,
  ) {
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
      <PlanEditor
        slug={slug}
        customerId={customerId}
        plan={editorFor === "new" ? null : editorFor}
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
          Planos do paciente
        </h2>
        <button
          onClick={() => {
            setError("");
            setEditorFor("new");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo plano
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum plano ainda. Clique em <strong>Novo plano</strong> para montar
            o primeiro cardápio.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {p.title}
                    {p.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> ativo
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                        arquivado
                      </span>
                    )}
                  </p>
                  {p.goal && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {p.goal}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {pendingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setError("");
                          setEditorFor(p);
                        }}
                        aria-label="Editar plano"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          quickAction(
                            () =>
                              setPlanActiveAction({
                                id: p.id,
                                customerId,
                                active: !p.active,
                              }),
                            p.id,
                          )
                        }
                        aria-label={p.active ? "Arquivar plano" : "Ativar plano"}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                      >
                        {p.active ? (
                          <Archive className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Remover este plano? O histórico é preservado.")) return;
                          quickAction(
                            () => deletePlanAction({ id: p.id, customerId }),
                            p.id,
                          );
                        }}
                        aria-label="Remover plano"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {p.meals.map((m) => (
                  <div key={m.meal}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
                      {m.label}
                    </p>
                    <ul className="space-y-1">
                      {m.items.map((it, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {it.food}
                          </span>
                          {it.amount && (
                            <span className="text-slate-400">— {it.amount}</span>
                          )}
                          {it.notes && (
                            <span className="text-xs text-slate-400">({it.notes})</span>
                          )}
                        </li>
                      ))}
                    </ul>
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

function PlanEditor({
  slug,
  customerId,
  plan,
  onClose,
  onSaved,
}: {
  slug: string;
  customerId: string;
  plan: MealPlanFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState(plan?.title ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [rows, setRows] = useState<EditorRow[]>(
    plan ? planToRows(plan) : [newRow()],
  );

  function update(key: string, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function addRow() {
    setRows((prev) => [...prev, newRow(prev[prev.length - 1]?.meal)]);
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await savePlanAction({
        id: plan?.id,
        customerId,
        title,
        goal,
        items: rows.map((r) => ({
          meal: r.meal,
          food: r.food,
          amount: r.amount,
          notes: r.notes,
        })),
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {plan ? "Editar plano" : "Novo plano"}
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
            placeholder="Ex.: Plano de emagrecimento"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Objetivo / orientações
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex.: Déficit calórico, beber 2L de água/dia"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <div className="hidden gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[7rem_1fr_7rem_1fr_2rem]">
          <span>Refeição</span>
          <span>Alimento</span>
          <span>Quantidade</span>
          <span>Observação</span>
          <span />
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr_7rem_1fr_2rem] sm:items-center"
            >
              <select
                value={r.meal}
                onChange={(e) => update(r.key, { meal: e.target.value })}
                aria-label="Refeição"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              >
                {MEAL_SECTIONS.map((s) => (
                  <option key={s.meal} value={s.meal}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                value={r.food}
                onChange={(e) => update(r.key, { food: e.target.value })}
                placeholder="Alimento"
                aria-label="Alimento"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
              <input
                value={r.amount}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                placeholder="2 fatias"
                aria-label="Quantidade"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
              <input
                value={r.notes}
                onChange={(e) => update(r.key, { notes: e.target.value })}
                placeholder="Observação (opcional)"
                aria-label="Observação"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
              <button
                onClick={() => removeRow(r.key)}
                disabled={rows.length === 1}
                aria-label="Remover linha"
                className="grid h-8 w-8 place-items-center justify-self-start rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar alimento
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
          {plan ? "Salvar plano" : "Criar plano"}
        </button>
      </div>
    </div>
  );
}
