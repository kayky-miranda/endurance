"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { stockAdviceAction } from "./reports-actions";

export default function StockAdvicePanel() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await stockAdviceAction();
      if (res.ok) {
        setText(res.text);
        setSource(res.source);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
      <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
        <Sparkles className="h-4 w-4" />
        Recomendação da IA
        {source && (
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-normal text-slate-500 dark:bg-ink-900/60">
            {source === "ai" ? "Gemini" : "automático"}
          </span>
        )}
      </p>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando o estoque…
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {text}
        </p>
      )}
    </div>
  );
}
