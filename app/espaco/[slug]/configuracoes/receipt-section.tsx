"use client";

import { useState, useTransition } from "react";
import { Receipt, Loader2, Check, AlertCircle } from "lucide-react";
import type { ReceiptConfig } from "@/lib/endurance/receipt-settings";
import { saveReceiptConfigAction } from "./receipt-actions";

/** Configuração do cupom impresso: formato do papel, logo e rodapé. */
export default function ReceiptSection({ config }: { config: ReceiptConfig }) {
  const [cfg, setCfg] = useState<ReceiptConfig>(config);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function set<K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError("");
    startTransition(async () => {
      const res = await saveReceiptConfigAction(cfg);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else setError(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Receipt className="h-4 w-4 text-brand-500" /> Recibo / cupom
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Como o comprovante de venda é impresso. O logo usa o mesmo da aparência
        da loja.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Formato do papel
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-ink-600">
            {(
              [
                ["80mm", "Bobina 80mm"],
                ["a4", "Folha A4"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => set("paperSize", v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  cfg.paperSize === v
                    ? "bg-brand-500 text-ink-950"
                    : "text-slate-500 hover:text-brand-500 dark:text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={cfg.showLogo}
            onChange={(e) => set("showLogo", e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Mostrar o logo da loja no topo
          </span>
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={cfg.showDocument}
            onChange={(e) => set("showDocument", e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Mostrar cidade/UF no cabeçalho
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Linha extra no topo (opcional)
          </span>
          <input
            value={cfg.headerNote}
            onChange={(e) => set("headerNote", e.target.value)}
            maxLength={120}
            placeholder="Ex.: Rua das Flores, 123 · (11) 99999-0000"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Mensagem de rodapé
          </span>
          <input
            value={cfg.footer}
            onChange={(e) => set("footer", e.target.value)}
            maxLength={160}
            placeholder="Obrigado pela preferência!"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </label>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-rose-500">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </button>
          {saved && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Salvo!
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
