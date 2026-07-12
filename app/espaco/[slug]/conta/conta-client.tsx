"use client";

import { useState } from "react";
import {
  Download,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  MailCheck,
  Check,
} from "lucide-react";
import { deleteAccountAction } from "./conta-actions";
import { resendVerificationAction } from "@/app/actions";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContaClient({
  name,
  email,
  role,
  emailVerified,
  phone,
  jobTitle,
  profile,
  orgName,
  createdAt,
  lastLoginAt,
}: {
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  phone: string;
  jobTitle: string;
  profile: string;
  orgName: string;
  createdAt: string | null;
  lastLoginAt: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role] ?? role;

  async function resendVerification() {
    setVerifying(true);
    setVerifyError(null);
    const res = await resendVerificationAction();
    setVerifying(false);
    if (res.ok) {
      setVerifySent(true);
      setTimeout(() => setVerifySent(false), 8000);
    } else {
      setVerifyError(res.error);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/export");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Não foi possível exportar.");
        return;
      }
      // Salva o JSON como download.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "endurance-meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        {/* Cabeçalho do perfil: avatar + nome + status do e-mail */}
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-500 text-xl font-semibold text-ink-950">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">{name}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <span className="truncate">{email}</span>
              {emailVerified ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  E-mail verificado
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                  <ShieldAlert className="h-3 w-3" />
                  E-mail não verificado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chamada de verificação em destaque quando o e-mail não está confirmado */}
        {!emailVerified && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Confirme seu e-mail para liberar emissão fiscal e troca de plano. Enviamos um link para{" "}
              <span className="font-mono">{email}</span>.
            </p>
            <div className="mt-2 flex items-center gap-2">
              {verifySent ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                  <Check className="h-3.5 w-3.5" />
                  E-mail de verificação enviado
                </span>
              ) : (
                <button
                  onClick={resendVerification}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {verifying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MailCheck className="h-3.5 w-3.5" />
                  )}
                  {verifying ? "Enviando…" : "Verificar e-mail"}
                </button>
              )}
              {verifyError && (
                <span className="text-xs text-rose-700 dark:text-rose-300">{verifyError}</span>
              )}
            </div>
          </div>
        )}

        {/* Dados detalhados */}
        <dl className="mt-4 grid gap-x-4 gap-y-2.5 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 dark:border-ink-800">
          <InfoRow label="Nome completo" value={name} />
          <InfoRow label="E-mail" value={email} />
          <InfoRow label="Telefone" value={phone || "—"} />
          <InfoRow label="Cargo" value={jobTitle || "—"} />
          <InfoRow label="Empresa" value={orgName} />
          <InfoRow label="Papel / nível de acesso" value={roleLabel} />
          {profile && <InfoRow label="Perfil" value={profile} />}
          <InfoRow label="Conta criada em" value={formatDate(createdAt)} />
          <InfoRow label="Último acesso" value={formatDate(lastLoginAt)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Privacidade e direitos do titular
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Conforme a LGPD (art. 18), você pode obter cópia dos seus dados pessoais e solicitar a exclusão da sua conta.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Exportar meus dados</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Baixa um arquivo JSON com perfil, atividades e referências de vendas operadas por você.
              </p>
            </div>
            <button
              onClick={exportData}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:text-cyan-600 disabled:opacity-50 dark:border-ink-600 dark:text-slate-200"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? "Exportando…" : "Exportar"}
            </button>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Excluir minha conta</p>
              <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-300/80">
                Anonimiza permanentemente seu cadastro. Dados fiscais permanecem pelo prazo legal de retenção. Esta ação não pode ser desfeita.
              </p>
            </div>
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir conta
            </button>
          </div>
        </div>
      </section>

      {showDelete && <DeleteConfirmModal onClose={() => setShowDelete(false)} />}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function DeleteConfirmModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await deleteAccountAction({ password, confirmation });
    if (res.ok) {
      window.location.href = "/?acct=deleted";
      return;
    }
    setLoading(false);
    setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
          Confirmar exclusão da conta
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Essa ação é irreversível. Para confirmar, digite sua senha e a frase abaixo.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sua senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Digite: <span className="font-mono text-rose-700 dark:text-rose-300">EXCLUIR MINHA CONTA</span>
            </span>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
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
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
