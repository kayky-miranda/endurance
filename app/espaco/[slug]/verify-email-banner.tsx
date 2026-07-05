"use client";

import { useState } from "react";
import { Mail, Loader2, X, Check } from "lucide-react";
import { resendVerificationAction } from "@/app/actions";

/**
 * Banner persistente no shell quando o e-mail ainda não foi confirmado.
 * Funções sensíveis (NFC-e, troca de plano) podem usar `session.emailVerified`
 * pra bloquear até confirmar — esta UI é o lembrete.
 *
 * O dismiss é local (localStorage) e só esconde por 24h — passou disso, volta.
 */
export default function VerifyEmailBanner({ email }: { email: string }) {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    const until = Number(localStorage.getItem("endurance:verify-dismissed-until") || 0);
    return until > Date.now();
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  async function resend() {
    setSending(true);
    setError(null);
    const res = await resendVerificationAction();
    setSending(false);
    if (res.ok) {
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } else {
      setError(res.error);
    }
  }

  function dismiss() {
    localStorage.setItem(
      "endurance:verify-dismissed-until",
      String(Date.now() + 24 * 60 * 60_000),
    );
    setHidden(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Mail className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">
        <strong>Confirme seu e-mail</strong>{" "}
        <span className="opacity-80">
          Enviamos um link para <span className="font-mono">{email}</span>. Algumas funções (emissão fiscal, troca de plano) ficam liberadas após a confirmação.
        </span>
      </span>
      {sent ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
          <Check className="h-3 w-3" />
          E-mail reenviado
        </span>
      ) : (
        <button
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300 disabled:opacity-50 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700"
        >
          {sending && <Loader2 className="h-3 w-3 animate-spin" />}
          Reenviar
        </button>
      )}
      {error && (
        <span className="text-xs text-rose-700 dark:text-rose-300">{error}</span>
      )}
      <button
        onClick={dismiss}
        title="Esconder por 24h"
        className="rounded-md p-1 text-amber-800 hover:bg-amber-200 dark:text-amber-200 dark:hover:bg-amber-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
