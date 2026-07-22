"use client";

import { useState } from "react";
import { Loader2, User, Lock, Check } from "lucide-react";
import { acceptInviteAction } from "@/app/espaco/[slug]/equipe/invite-actions";

export default function ConviteForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await acceptInviteAction({ token, name, password });
    if (res.ok) {
      setDone(true);
      // Sessão já criada no servidor — leva pro espaço.
      setTimeout(() => (window.location.href = "/"), 800);
      return;
    }
    setLoading(false);
    setError(res.error);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          Cadastro concluído
        </div>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          Entrando no seu espaço…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Seu nome
        </span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
          <User className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Como você quer ser chamado(a)"
            className="ml-2 w-full bg-transparent py-2.5 text-sm focus:outline-none dark:text-white" />
        </div>
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Crie uma senha
        </span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
          <Lock className="h-4 w-4 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 chars com letra e número"
            className="ml-2 w-full bg-transparent py-2.5 text-sm focus:outline-none dark:text-white" />
        </div>
      </label>
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando…" : "Aceitar convite e entrar"}
      </button>
    </form>
  );
}
