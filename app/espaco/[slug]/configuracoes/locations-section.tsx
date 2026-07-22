"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Plus,
  Loader2,
  Star,
  Power,
  AlertCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { LocationRow } from "@/lib/endurance/locations";
import {
  createLocationAction,
  updateLocationAction,
  setDefaultLocationAction,
  setLocationActiveAction,
} from "./locations-actions";

/** Locais de estoque: matriz, filiais, lojas e depósitos. */
export default function LocationsSection({ locations }: { locations: LocationRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else setError(res.error ?? "Não foi possível concluir.");
    });
  }

  function add() {
    if (!name.trim()) return;
    run(() => createLocationAction({ name, code, city, state: uf }), () => {
      setName("");
      setCode("");
      setCity("");
      setUf("");
      setAdding(false);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Store className="h-4 w-4 text-brand-500" /> Locais de estoque
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Matriz, filiais, lojas e depósitos. Cada produto tem saldo próprio em
            cada local; o total do catálogo é a soma de todos.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <Plus className="h-3.5 w-3.5" /> Novo local
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-ink-600">
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (ex.: Loja Centro)"
              className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
             aria-label="Nome (ex.: Loja Centro)" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Sigla"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
             aria-label="Sigla" />
            <div className="flex gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cidade"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
               aria-label="Cidade" />
              <input
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                placeholder="UF"
                maxLength={2}
                className="w-14 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm uppercase dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
               aria-label="UF" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
            >
              Cancelar
            </button>
            <button
              onClick={add}
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Adicionar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-3 divide-y divide-slate-100 dark:divide-ink-800">
        {locations.map((l) => (
          <div key={l.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              {editingId === l.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={editName}
                    aria-label="Novo nome do local"
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        run(() => updateLocationAction(l.id, { name: editName }), () =>
                          setEditingId(null),
                        );
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                  />
                  <button
                    onClick={() =>
                      run(() => updateLocationAction(l.id, { name: editName }), () =>
                        setEditingId(null),
                      )
                    }
                    className="grid h-7 w-7 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {l.name}
                    {l.code && (
                      <span className="font-mono text-[11px] text-slate-400">{l.code}</span>
                    )}
                    {l.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                        <Star className="h-2.5 w-2.5" /> padrão
                      </span>
                    )}
                    {!l.active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400 dark:bg-ink-800">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {[l.city, l.state].filter(Boolean).join("/") || "sem endereço"} ·{" "}
                    {l.skus} produto(s) · {l.units} unidade(s)
                  </p>
                </>
              )}
            </div>

            {editingId !== l.id && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setEditingId(l.id);
                    setEditName(l.name);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500/60 hover:text-brand-500 dark:border-ink-600"
                  title="Renomear"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!l.isDefault && l.active && (
                  <button
                    onClick={() => run(() => setDefaultLocationAction(l.id))}
                    disabled={busy}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600"
                    title="Tornar padrão"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                {!l.isDefault && (
                  <button
                    onClick={() => run(() => setLocationActiveAction(l.id, !l.active))}
                    disabled={busy}
                    className={`grid h-8 w-8 place-items-center rounded-lg border border-slate-200 transition disabled:opacity-40 dark:border-ink-600 ${
                      l.active
                        ? "text-slate-400 hover:border-rose-500/50 hover:text-rose-500"
                        : "text-emerald-500 hover:border-emerald-500/50"
                    }`}
                    title={l.active ? "Inativar" : "Reativar"}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
