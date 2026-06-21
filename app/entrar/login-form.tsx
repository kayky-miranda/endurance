"use client";

import { useState } from "react";
import { Loader2, Mail, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { loginAction, verifyTotpLoginAction } from "../actions";

export default function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "totp">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function goTo(slug: string) {
    window.location.href =
      next && next.startsWith("/espaco/") ? next : `/espaco/${slug}`;
  }

  async function submitPassword() {
    if (loading || !email || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await loginAction(email, password);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      if ("needs2fa" in res) {
        setStep("totp");
        setLoading(false);
        return;
      }
      goTo(res.slug);
    } catch {
      setError("Algo deu errado. Tente de novo.");
      setLoading(false);
    }
  }

  async function submitTotp() {
    if (loading || code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyTotpLoginAction(code);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      if ("slug" in res) goTo(res.slug);
    } catch {
      setError("Algo deu errado. Tente de novo.");
      setLoading(false);
    }
  }

  if (step === "totp") {
    return (
      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Senha confirmada. Agora informe o código do seu app de autenticação.
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitTotp();
          }}
          autoFocus
          placeholder="000000"
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-slate-100 placeholder:text-slate-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={submitTotp}
          disabled={loading || code.length !== 6}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Verificando…" : "Verificar e entrar"}
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setCode("");
              setError("");
            }}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
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
            if (e.key === "Enter") submitPassword();
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
        onClick={submitPassword}
        disabled={loading || !email || !password}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando…" : "Entrar"}
      </button>

      <div className="pt-1 text-center">
        <a
          href="/recuperar"
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          Esqueci minha senha
        </a>
      </div>
    </div>
  );
}
