"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Check } from "lucide-react";
import { resetPasswordAction } from "../../recuperar/actions";

export default function RedefinirForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const res = await resetPasswordAction(token, password);
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/entrar"), 1800);
    } else setError(res.error);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          Senha redefinida
        </div>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          Você será levado para o login…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Nova senha
        </span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
          <Lock className="h-4 w-4 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            placeholder="Mínimo 8 caracteres com letra e número"
            className="ml-2 w-full bg-transparent py-2.5 text-sm focus:outline-none dark:text-white" />
        </div>
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Confirme a senha
        </span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
          <Lock className="h-4 w-4 text-slate-400" />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            placeholder="Digite a senha novamente"
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
        {loading ? "Salvando…" : "Redefinir senha"}
      </button>
    </form>
  );
}
