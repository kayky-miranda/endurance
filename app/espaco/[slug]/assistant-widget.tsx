"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { assistantAction } from "./assistant-actions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como faço uma venda no PDV?",
  "Como cadastrar um produto?",
  "Como dar desconto numa venda?",
];

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await assistantAction(next);
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: res.ok ? res.reply : res.error },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Algo deu errado. Tente de novo." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-black/20 transition hover:bg-brand-400"
        >
          <Sparkles className="h-5 w-5" />
          Assistente
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/30 dark:border-ink-700 dark:bg-ink-900">
          <header className="flex items-center justify-between border-b border-slate-200 bg-brand-500/10 px-4 py-3 dark:border-ink-800">
            <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-brand-500" />
              Assistente IA
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Oi! Sou o assistente operacional. Posso ajudar com o uso do
                  sistema e o dia a dia do caixa.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-brand-500 text-ink-950"
                      : "bg-slate-100 text-slate-700 dark:bg-ink-800 dark:text-slate-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-ink-800">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Pergunte algo…"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
