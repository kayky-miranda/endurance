"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  X,
  Check,
  Copy,
} from "lucide-react";
import {
  startTotpSetupAction,
  enable2faAction,
  disable2faAction,
  regenerateBackupCodesAction,
  changePasswordAction,
} from "./security-actions";

export default function SecuritySection({
  totpEnabled,
  backupCodesRemaining,
}: {
  totpEnabled: boolean;
  backupCodesRemaining: number;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  async function regenerate() {
    if (
      !confirm(
        "Os backup codes atuais serão invalidados. Continuar?",
      )
    )
      return;
    setRegenLoading(true);
    const res = await regenerateBackupCodesAction();
    setRegenLoading(false);
    if (res.ok) setRegenCodes(res.backupCodes);
    else alert(res.error);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Segurança da conta
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Camada extra de proteção contra acesso indevido — recomendado
        especialmente para perfis com acesso a dados financeiros e fiscais.
      </p>

      {/* Senha */}
      <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Senha</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Use uma senha forte e exclusiva. Exige a senha atual para alterar.
          </p>
        </div>
        <button
          onClick={() => setPwdOpen(true)}
          className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
        >
          Alterar senha
        </button>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {totpEnabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Autenticação em duas etapas (2FA)
            </p>
            {totpEnabled && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                Ativo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totpEnabled
              ? "Você precisa do código do seu app de autenticação a cada login."
              : "Use Google Authenticator, 1Password, Authy ou outro app TOTP."}
          </p>
        </div>
        {totpEnabled ? (
          <button
            onClick={() => setDisableOpen(true)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
          >
            Desativar
          </button>
        ) : (
          <button
            onClick={() => setSetupOpen(true)}
            className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold hover:bg-brand-600"
            style={{ color: "var(--color-button-text)" }}
          >
            Ativar 2FA
          </button>
        )}
      </div>

      {/* Status dos backup codes, só quando 2FA está ativo */}
      {totpEnabled && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-ink-700">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Códigos de recuperação
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Restam {backupCodesRemaining}/8 códigos não usados.{" "}
              {backupCodesRemaining < 3 && (
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  Recomendado regenerar.
                </span>
              )}
            </p>
          </div>
          <button
            onClick={regenerate}
            disabled={regenLoading}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-ink-700 dark:text-slate-200 dark:hover:bg-ink-800"
          >
            {regenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerar"}
          </button>
        </div>
      )}

      {regenCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Novos códigos de recuperação
            </h3>
            <div className="mt-4">
              <BackupCodesPanel codes={regenCodes} />
            </div>
            <button
              onClick={() => setRegenCodes(null)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold hover:bg-brand-600"
              style={{ color: "var(--color-button-text)" }}
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {setupOpen && <SetupModal onClose={() => setSetupOpen(false)} />}
      {disableOpen && <DisableModal onClose={() => setDisableOpen(false)} />}
      {pwdOpen && <ChangePasswordModal onClose={() => setPwdOpen(false)} />}
    </section>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setLoading(true);
    const res = await changePasswordAction(current, next);
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(onClose, 1600);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Alterar senha</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />
              Senha alterada
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <PwdField label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
            <PwdField label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" />
            <PwdField label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <p className="text-[11px] text-slate-500">
              Mínimo 8 caracteres, com ao menos uma letra e um número.
            </p>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !current || !next || !confirm}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
                style={{ color: "var(--color-button-text)" }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PwdField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
        <Lock className="h-4 w-4 text-slate-400" />
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          className="ml-2 w-full bg-transparent py-2.5 text-sm focus:outline-none dark:text-white"
        />
      </div>
    </label>
  );
}

function SetupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"start" | "scan" | "done">("start");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function start() {
    setLoading(true);
    setError(null);
    const res = await startTotpSetupAction();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setQr(res.qrDataUrl);
    setSecret(res.secret);
    setPhase("scan");
  }

  async function confirm() {
    setLoading(true);
    setError(null);
    const res = await enable2faAction(code);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBackupCodes(res.backupCodes);
    setPhase("done");
    router.refresh();
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Ativar 2FA
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "start" && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Em 3 passos:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Tenha um app autenticador instalado.</li>
              <li>Escaneie o QR Code que vamos exibir.</li>
              <li>Confirme com o código de 6 dígitos do app.</li>
            </ol>
            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}
            <button
              onClick={start}
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
              style={{ color: "var(--color-button-text)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Começar
            </button>
          </>
        )}

        {phase === "scan" && qr && secret && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Escaneie o QR Code com seu app de autenticação:
            </p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code 2FA" className="rounded-lg" width={220} height={220} />
            </div>
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                Não consegue escanear? Digite o código manualmente
              </summary>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-ink-800">
                <code className="flex-1 font-mono text-xs break-all">{secret}</code>
                <button
                  onClick={copySecret}
                  className="rounded-md p-1 text-slate-400 hover:text-brand-500"
                  title="Copiar"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </details>

            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Código do app
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-center font-mono text-lg tracking-[0.4em] focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              />
            </label>
            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}
            <button
              onClick={confirm}
              disabled={loading || code.length !== 6}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
              style={{ color: "var(--color-button-text)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar e ativar
            </button>
          </>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" />
                2FA ativado
              </div>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                No próximo login você precisará informar o código do app.
              </p>
            </div>
            <BackupCodesPanel codes={backupCodes} />
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold hover:bg-brand-600"
              style={{ color: "var(--color-button-text)" }}
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BackupCodesPanel({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob(
      [
        "ENDURANCE — Backup codes\n",
        "Cada código vale UMA vez. Guarde em local seguro.\n",
        "Sem o app de autenticação E sem estes códigos, você perde acesso.\n\n",
        ...codes.map((c) => c + "\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `endurance-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!codes.length) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
        ⚠️ Guarde estes 8 códigos de recuperação
      </p>
      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
        Use um deles se perder o app de autenticação. Cada código vale UMA vez. <strong>Não mostraremos de novo.</strong>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-white p-2 font-mono text-xs dark:bg-ink-900">
        {codes.map((c) => (
          <span key={c} className="text-center text-slate-800 dark:text-slate-200">
            {c}
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={copyAll}
          className="flex-1 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
          onClick={download}
          className="flex-1 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700"
        >
          Baixar .txt
        </button>
      </div>
    </div>
  );
}

function DisableModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await disable2faAction(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
          Desativar 2FA
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Sua conta volta a ser protegida só por senha. Para confirmar, informe sua senha atual.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 dark:border-ink-700 dark:bg-ink-800">
            <Lock className="h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Sua senha"
              className="ml-2 w-full bg-transparent py-2.5 text-sm focus:outline-none dark:text-white"
            />
          </div>
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
              disabled={loading || !password}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Desativar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
