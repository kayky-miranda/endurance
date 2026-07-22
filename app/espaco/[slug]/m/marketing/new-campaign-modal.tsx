"use client";

import { useState } from "react";
import { Sparkles, X, AlertCircle, Loader2 } from "lucide-react";
import type { GenerateResult } from "./types";

const EXAMPLES = [
  "Promoção de fim de semana com 20% de desconto em todos os produtos",
  "Lançamento do nosso novo serviço de entrega em domicílio",
  "Dicas para os clientes aproveitarem melhor nossos produtos",
];

export function NewCampaignModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (result: GenerateResult) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar.");
        return;
      }
      onGenerated(data as GenerateResult);
      onClose();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo carrossel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Descreva o tema do carrossel. A IA criará 7 slides profissionais.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex.: Promoção de final de semana com 30% off em todos os produtos do açougue..."
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
         aria-label="Ex.: Promoção de final de semana com 30% off em todos os produtos do açougue..." />

        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-800 dark:text-slate-300"
            >
              {ex.slice(0, 40)}…
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Gerando…" : "Gerar (1 crédito)"}
          </button>
        </div>
      </div>
    </div>
  );
}
