"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  Plus,
  Loader2,
  Copy,
  CheckCircle2,
  Ban,
  AlertCircle,
} from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction } from "./api-keys-actions";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdByName: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** Gerência das chaves da API pública (/api/v1). */
export default function ApiKeysSection({ keys }: { keys: ApiKeyRow[] }) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function create() {
    if (!name.trim() || busy) return;
    setError("");
    startTransition(async () => {
      const res = await createApiKeyAction(name.trim());
      if (res.ok) {
        setNewToken(res.token);
        setName("");
      } else setError(res.error);
    });
  }

  function revoke(id: string) {
    if (!confirm("Revogar esta chave? Integrações que a usam param imediatamente."))
      return;
    startTransition(async () => {
      const res = await revokeApiKeyAction(id);
      if (!res.ok) setError(res.error ?? "Falha ao revogar.");
    });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* seleção manual cobre */
    }
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <KeyRound className="h-4 w-4 text-brand-500" /> API pública
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Integre sistemas externos via <code className="font-mono">/api/v1</code>{" "}
        (produtos, clientes e vendas). Autentique com{" "}
        <code className="font-mono">Authorization: Bearer &lt;chave&gt;</code> —
        limite de 120 req/min por chave.
      </p>

      {/* Token recém-criado — única exibição */}
      {newToken && (
        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Chave criada — copie AGORA (não será mostrada de novo):
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 font-mono text-xs dark:bg-ink-950 dark:text-slate-200">
              {newToken}
            </code>
            <button
              onClick={() => copy(newToken)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              title="Copiar"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Criar */}
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Nome da chave (ex.: Integração ecommerce)"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
         aria-label="Nome da chave (ex.: Integração ecommerce)" />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {/* Lista */}
      {keys.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 dark:divide-ink-800">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${k.revokedAt ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}>
                  {k.name}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-400">
                  {k.prefix}… · criada {fmt(k.createdAt)} por {k.createdByName || "—"} ·
                  último uso {fmt(k.lastUsedAt)}
                </p>
              </div>
              {k.revokedAt ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400 dark:bg-ink-800">
                  revogada
                </span>
              ) : (
                <button
                  onClick={() => revoke(k.id)}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-500/50 hover:text-rose-500 dark:border-ink-600"
                >
                  <Ban className="h-3 w-3" /> Revogar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
