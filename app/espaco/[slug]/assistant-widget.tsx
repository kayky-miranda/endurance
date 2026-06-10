"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Sparkles,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CircleDollarSign,
  BarChart3,
} from "lucide-react";
import { assistantAction } from "./assistant-actions";
import type { Widget } from "@/lib/endurance/assistant";

type Msg = { role: "user" | "assistant"; content: string; widgets?: Widget[] };

const SUGGESTIONS = [
  "Qual foi meu faturamento ontem?",
  "Quanto vendi este mês?",
  "Top 5 produtos do mês",
  "Clientes que mais compraram",
  "Produtos com estoque crítico",
  "Quais contas vencem hoje?",
  "Compare as vendas deste mês com o passado",
  "Qual meu lucro deste mês?",
];

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      // Envia só role+content para o agente (widgets ficam só na UI).
      const res = await assistantAction(next.map((m) => ({ role: m.role, content: m.content })));
      setMsgs((m) => [
        ...m,
        res.ok
          ? { role: "assistant", content: res.reply, widgets: res.widgets }
          : { role: "assistant", content: res.error },
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

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
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
          Gerente IA
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(88vh,680px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/30 dark:border-ink-700 dark:bg-ink-900">
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-500/15 to-transparent px-4 py-3 dark:border-ink-800">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/20 text-brand-500 ring-1 ring-brand-500/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                ENDURANCE IA
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Seu gerente virtual · consulta dados em tempo real
              </p>
            </div>
            {msgs.length > 0 && (
              <button
                onClick={() => setMsgs([])}
                title="Nova conversa"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-200"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Conversa */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <Welcome onPick={send} />
            )}

            {msgs.map((m, i) => (
              <MessageRow key={i} msg={m} />
            ))}

            {busy && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Sugestões rápidas (sempre acessíveis) */}
          {msgs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 dark:border-ink-800">
              {SUGGESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={busy}
                  className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-50 dark:border-ink-600 dark:text-slate-300"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-200 p-3 dark:border-ink-800">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Pergunte sobre vendas, lucro, estoque, clientes…"
                className="max-h-28 flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
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

// --------------------------------------------------------------------------
function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="pt-2">
      <div className="mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <Sparkles className="h-5 w-5 text-brand-500" />
        <p className="text-sm font-medium">Olá! Sou seu gerente virtual.</p>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pergunte em linguagem natural — eu consulto os dados reais do seu negócio
        e respondo com números, tabelas e análises.
      </p>
      <div className="mt-4 grid gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:border-brand-500 hover:bg-brand-500/5 hover:text-brand-600 dark:border-ink-600 dark:text-slate-300 dark:hover:text-brand-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-500 px-3.5 py-2 text-sm text-ink-950">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/20">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2 text-sm text-slate-700 dark:bg-ink-800 dark:text-slate-200">
          <RichText text={msg.content} />
        </div>
        {msg.widgets?.map((w, i) => (
          <WidgetView key={i} w={w} />
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/20">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 dark:bg-ink-800">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}
function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
      style={{ animationDelay: delay }}
    />
  );
}

/** Renderiza **negrito** simples do texto do modelo. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

// --------------------------------------------------------------------------
// Renderização dos widgets dentro do chat
// --------------------------------------------------------------------------
function WidgetView({ w }: { w: Widget }) {
  if (w.type === "kpi") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <Header icon={CircleDollarSign} title={w.title} sub={w.period} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {w.items.map((it, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-2.5 dark:bg-ink-950/60">
              <p className="text-[11px] text-slate-500">{it.label}</p>
              <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-100">
                {it.value}
              </p>
              {it.sub && <p className="text-[10px] text-slate-400">{it.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (w.type === "compare") {
    const up = w.deltaPct > 0;
    const flat = w.deltaPct === 0;
    const DeltaIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
    const tone = flat
      ? "text-slate-500 bg-slate-100 dark:bg-ink-800"
      : up
        ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300"
        : "text-red-500 bg-red-500/10 dark:text-red-300";
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <Header icon={BarChart3} title={`${w.title} · ${w.metric}`} />
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-slate-50 p-2.5 dark:bg-ink-950/60">
            <p className="text-[11px] text-slate-500">{w.a.label}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{w.a.value}</p>
          </div>
          <div className="flex-1 rounded-lg bg-slate-50 p-2.5 dark:bg-ink-950/60">
            <p className="text-[11px] text-slate-500">{w.b.label}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{w.b.value}</p>
          </div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${tone}`}>
            <DeltaIcon className="h-4 w-4" />
            {w.deltaPct > 0 ? "+" : ""}
            {w.deltaPct}%
          </div>
        </div>
      </div>
    );
  }

  if (w.type === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
        <div className="border-b border-slate-100 px-3 py-2 dark:border-ink-800">
          <Header icon={BarChart3} title={w.title} />
        </div>
        {w.rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">Sem dados no período.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                {w.columns.map((c, i) => (
                  <th key={i} className={`px-3 py-1.5 font-medium ${i >= 2 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {w.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-slate-50 dark:border-ink-800">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-1.5 ${
                        ci >= 2
                          ? "text-right font-medium text-slate-700 dark:text-slate-200"
                          : "text-slate-600 dark:text-slate-300"
                      } ${ci === 1 ? "max-w-[140px] truncate" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (w.type === "list") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
        <Header icon={AlertTriangle} title={w.title} />
        {w.items.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">Nada por aqui. 👍</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {w.items.map((it, i) => {
              const dot =
                it.tone === "danger"
                  ? "bg-red-500"
                  : it.tone === "warn"
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {it.title}
                    </p>
                    {it.sub && <p className="text-[11px] text-slate-500">{it.sub}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return null;
}

function Header({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Sparkles;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-brand-500" />
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</span>
      {sub && <span className="text-[11px] text-slate-400">· {sub}</span>}
    </div>
  );
}
