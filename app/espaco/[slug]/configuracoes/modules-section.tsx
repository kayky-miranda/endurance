"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Loader2,
  AlertCircle,
  Sparkles,
  Lock,
} from "lucide-react";
import type { ModulesConfig } from "@/lib/endurance/modules-admin";
import { setModuleEnabledAction, setOrgNicheAction } from "./modules-actions";

/**
 * Ramo de atuação + módulos ativos. É aqui que a plataforma se adapta ao
 * segmento: escolher o ramo liga os módulos daquele nicho; os toggles afinam
 * o que aparece na navegação.
 */
export default function ModulesSection({ config }: { config: ModulesConfig }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmNiche, setConfirmNiche] = useState("");

  function toggle(id: string, enabled: boolean) {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await setModuleEnabledAction(id, enabled);
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Não foi possível alterar.");
    });
  }

  function changeNiche(niche: string) {
    if (!niche || niche === config.niche) {
      setConfirmNiche("");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await setOrgNicheAction(niche);
      setConfirmNiche("");
      if (res.ok) router.refresh();
      else setError(res.error ?? "Não foi possível trocar o ramo.");
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <LayoutGrid className="h-4 w-4 text-brand-500" /> Ramo de atuação e módulos
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        O ramo define quais módulos o sistema recomenda. Você pode ligar ou
        desligar módulos a qualquer momento — só aparece na navegação o que
        estiver ativo.
      </p>

      {/* Ramo de atuação */}
      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">
          Ramo de atuação
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={config.niche}
            disabled={busy}
            aria-label="Ramo de atuação"
            onChange={(e) => setConfirmNiche(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          >
            {!config.niche && <option value="">Selecione…</option>}
            {config.niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          {confirmNiche && confirmNiche !== config.niche && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <button
                onClick={() => changeNiche(confirmNiche)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Aplicar e ativar módulos
              </button>
              <button
                onClick={() => setConfirmNiche("")}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                cancelar
              </button>
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Trocar o ramo LIGA os módulos recomendados dele — não desliga os que
          você já usa.
        </p>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {/* Módulos por categoria */}
      <div className="mt-5 space-y-5">
        {config.categories.map((cat) => (
          <div key={cat.category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {cat.category}
            </p>
            <div className="divide-y divide-slate-100 dark:divide-ink-800">
              {cat.modules.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {m.label}
                      {m.core && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800">
                          <Lock className="h-2.5 w-2.5" /> essencial
                        </span>
                      )}
                      {!m.core && m.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                          <Sparkles className="h-2.5 w-2.5" /> recomendado
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-400">{m.description}</p>
                  </div>

                  {pendingId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <button
                      role="switch"
                      aria-checked={m.enabled}
                      aria-label={`${m.enabled ? "Desativar" : "Ativar"} ${m.label}`}
                      disabled={m.core || busy}
                      onClick={() => toggle(m.id, !m.enabled)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                        m.enabled ? "bg-brand-500" : "bg-slate-300 dark:bg-ink-700"
                      } ${m.core ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                          m.enabled ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
