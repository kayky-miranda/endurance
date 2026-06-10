"use client";

import { useState } from "react";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { loginAction } from "../actions";

export default function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (loading || !email || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await loginAction(email, password);
      if (res.ok) {
        window.location.href =
          next && next.startsWith("/espaco/") ? next : `/espaco/${res.slug}`;
      } else {
        setError(res.error);
        setLoading(false);
      }
    } catch {
      setError("Algo deu errado. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          className="w-full rounded-xl border border-ink-600 bg-ink-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Senha"
          className="w-full rounded-xl border border-ink-600 bg-ink-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || !email || !password}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}
