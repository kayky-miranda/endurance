"use client";

import { useState } from "react";
import { Loader2, Mail, X, Check, Send } from "lucide-react";
import { createInviteAction } from "./invite-actions";
import { useModalA11y } from "../use-modal-a11y";

interface ProfileOption {
  id: string;
  label: string;
  description?: string;
}

export default function InviteModal({
  profiles,
  onClose,
}: {
  profiles: ProfileOption[];
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState(profiles[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createInviteAction({ email, profile });
    setLoading(false);
    if (res.ok) {
      setSent(true);
      setEmail("");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-500">
              <Mail className="h-4 w-4" />
            </div>
            <h3 id="invite-title" className="text-base font-bold text-slate-900 dark:text-white">
              Convidar membro
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Enviamos um link mágico por e-mail. O convidado define a própria senha — você não precisa criar nem compartilhar nenhuma.
        </p>

        {sent ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />
              Convite enviado
            </div>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
              O link expira em 7 dias. Você pode acompanhar e reenviar na aba “Convites pendentes”.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSent(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
              >
                Enviar outro
              </button>
              <button
                onClick={onClose}
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-ink-950 hover:bg-brand-400"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                E-mail do convidado
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="convidado@empresa.com"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
               aria-label="convidado@empresa.com" />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Perfil de acesso
              </span>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {profiles.find((p) => p.id === profile)?.description && (
                <p className="mt-1 text-xs text-slate-400">
                  {profiles.find((p) => p.id === profile)?.description}
                </p>
              )}
            </label>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !email}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
