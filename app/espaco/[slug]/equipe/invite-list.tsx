"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  RefreshCw,
  XCircle,
  Clock,
} from "lucide-react";
import { resendInviteAction, cancelInviteAction } from "./invite-actions";

interface InviteView {
  id: string;
  email: string;
  role: string;
  profile: string;
  expiresAt: string;
  createdAt: string;
}

interface ProfileDef {
  id: string;
  label: string;
}

export default function InviteList({
  invites,
  profiles,
}: {
  invites: InviteView[];
  profiles: ProfileDef[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const profileLabel = (id: string) =>
    profiles.find((p) => p.id === id)?.label ?? id;

  async function resend(id: string) {
    setBusy(`resend:${id}`);
    const res = await resendInviteAction(id);
    setBusy(null);
    if (res.ok) {
      router.refresh();
      alert("E-mail reenviado.");
    } else alert(res.error);
  }

  async function cancel(id: string, email: string) {
    if (!confirm(`Cancelar convite para ${email}?`)) return;
    setBusy(`cancel:${id}`);
    const res = await cancelInviteAction(id);
    setBusy(null);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  if (invites.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-ink-700">
        <Mail className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Nenhum convite pendente
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Convites aparecem aqui até serem aceitos ou cancelados.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {invites.map((inv) => {
        const expires = new Date(inv.expiresAt);
        const daysLeft = Math.max(
          0,
          Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60_000)),
        );
        const expiringSoon = daysLeft <= 1;
        return (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {inv.email}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{profileLabel(inv.profile)}</span>
                <span>·</span>
                <span className={`inline-flex items-center gap-1 ${expiringSoon ? "text-amber-600 dark:text-amber-400" : ""}`}>
                  <Clock className="h-3 w-3" />
                  {daysLeft === 0
                    ? "Expira hoje"
                    : daysLeft === 1
                      ? "Expira amanhã"
                      : `Expira em ${daysLeft} dias`}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => resend(inv.id)}
              disabled={busy === `resend:${inv.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
            >
              {busy === `resend:${inv.id}` ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Reenviar
            </button>
            <button
              type="button"
              onClick={() => cancel(inv.id, inv.email)}
              disabled={busy === `cancel:${inv.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              {busy === `cancel:${inv.id}` ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Cancelar
            </button>
          </div>
        );
      })}
    </div>
  );
}
