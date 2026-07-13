"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CircleDollarSign,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import type { AssistantEvent, Widget } from "@/lib/endurance/assistant";
import MrChippy from "./mr-chippy";

type Msg = { role: "user" | "assistant"; content: string; widgets?: Widget[] };

/** Rótulo amigável para o status "consultando ferramenta X". */
const TOOL_LABEL: Record<string, string> = {
  consultar_vendas: "consultando as vendas",
  consultar_lucro: "calculando o lucro",
  comparar_vendas: "comparando períodos",
  produtos_mais_vendidos: "buscando os mais vendidos",
  melhores_clientes: "buscando os melhores clientes",
  estoque_critico: "checando o estoque",
  pedidos_pendentes_fornecedores: "checando os fornecedores",
  contas_a_vencer: "buscando as contas",
  resumo_financeiro: "consultando o financeiro",
};

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

/** Saudação curta conforme o horário — dá o tom de "companheiro de bordo". */
function greeting(name?: string): string {
  const h = new Date().getHours();
  const part = h < 6 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `${part}, ${first}!` : `${part}!`;
}

/** Posição persistida do widget (top-left, px). null = padrão (canto inferior direito). */
const POS_KEY = "endurance:chippy-pos";

export default function AssistantWidget({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""); // "consultando as vendas…"
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, status, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setStatus("");

    // Atualiza a mensagem do assistente em construção; cria no 1º evento.
    let started = false;
    const patch = (fn: (last: Msg) => Msg) =>
      setMsgs((m) => {
        const copy = [...m];
        if (!started || copy[copy.length - 1]?.role !== "assistant") {
          started = true;
          copy.push({ role: "assistant", content: "", widgets: [] });
        }
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      // Envia só role+content para o agente (widgets ficam só na UI).
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));

      // Consome o NDJSON do streaming linha a linha.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const ln of lines) {
          if (!ln.trim()) continue;
          let ev: AssistantEvent;
          try {
            ev = JSON.parse(ln) as AssistantEvent;
          } catch {
            continue;
          }
          if (ev.type === "tool") {
            setStatus(`${TOOL_LABEL[ev.name] ?? "consultando os dados"}…`);
          } else if (ev.type === "widget") {
            const w = ev.widget;
            patch((last) => ({ ...last, widgets: [...(last.widgets ?? []), w] }));
          } else if (ev.type === "delta") {
            setStatus("");
            const t = ev.text;
            patch((last) => ({ ...last, content: last.content + t }));
          } else if (ev.type === "reset") {
            if (started) patch((last) => ({ ...last, content: "" }));
          } else if (ev.type === "error") {
            const e = ev.error;
            patch((last) => ({ ...last, content: e }));
          }
        }
      }
      if (!started) {
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: "Não consegui responder agora." },
        ]);
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Algo deu errado. Tente de novo." },
      ]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /* ---------------- Drag & drop do widget ---------------- */
  // pos = coordenadas top-left do contêiner; null = posição padrão (CSS).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ px: 0, py: 0, ox: 0, oy: 0, moved: false });
  // Após um arrasto, suprime o clique que o navegador dispara no pointerup —
  // é isso que diferencia "arrastar" de "clicar para abrir".
  const suppressClick = useRef(false);

  const clampPos = (p: { x: number; y: number }) => {
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 380;
    const h = el?.offsetHeight ?? 64;
    const M = 8; // margem mínima até a borda da viewport
    return {
      x: Math.min(Math.max(M, p.x), Math.max(M, window.innerWidth - w - M)),
      y: Math.min(Math.max(M, p.y), Math.max(M, window.innerHeight - h - M)),
    };
  };

  // Restaura a última posição salva (e garante que ela cabe na tela atual).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof p.x === "number" && typeof p.y === "number")
        setPos(clampPos({ x: p.x, y: p.y }));
    } catch {
      /* posição corrompida → fica no padrão */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém dentro da viewport ao redimensionar a janela e ao abrir o painel
  // (o painel é maior que o botão flutuante).
  useEffect(() => {
    const reclamp = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", reclamp);
    const raf = requestAnimationFrame(reclamp);
    return () => {
      window.removeEventListener("resize", reclamp);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Inicia o arrasto (mouse OU touch, via Pointer Events). */
  function startDrag(e: React.PointerEvent) {
    // Botões dentro do header continuam clicáveis sem virar arrasto.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: r.left,
      oy: r.top,
      moved: false,
    };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      const dx = ev.clientX - d.px;
      const dy = ev.clientY - d.py;
      // Limiar de 6px: abaixo disso é clique, não arrasto.
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dragRef.current.moved) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        setPos((p) => {
          if (p)
            try {
              localStorage.setItem(POS_KEY, JSON.stringify(p));
            } catch {
              /* storage cheio/bloqueado — segue sem persistir */
            }
          return p;
        });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Volta o widget pra posição padrão (canto inferior direito). */
  function resetPosition() {
    setPos(null);
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      ref={boxRef}
      className={`fixed z-50 ${pos ? "" : "bottom-5 right-5"}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
    >
      {!open && (
        <button
          onPointerDown={startDrag}
          onClick={() => {
            if (suppressClick.current) return;
            setOpen(true);
          }}
          aria-label="Abrir o Mr. Chippy"
          title="Clique para abrir · arraste para mover"
          className="group inline-flex cursor-grab touch-none items-center gap-2 rounded-full bg-brand-500 py-2 pl-2 pr-4 text-sm font-semibold text-ink-950 shadow-lg shadow-black/20 transition hover:bg-brand-400 active:cursor-grabbing"
        >
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="pulse-ring absolute inset-0 rounded-full bg-brand-300/50" />
            <span className="chippy-bob grid h-9 w-9 place-items-center rounded-full bg-ink-950/10">
              <MrChippy className="h-7 w-7" mood="happy" />
            </span>
          </span>
          Mr. Chippy
        </button>
      )}

      {open && (
        <div className="chippy-pop flex h-[min(88vh,680px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/30 dark:border-ink-700 dark:bg-ink-900">
          {/* Header — também é a alça de arrasto do painel aberto */}
          <header
            onPointerDown={startDrag}
            className="flex cursor-grab touch-none select-none items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-500/15 to-transparent px-4 py-3 active:cursor-grabbing dark:border-ink-800"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
              <MrChippy className="h-7 w-7" mood={busy ? "thinking" : "idle"} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Mr. Chippy
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Seu companheiro de bordo · consulta dados em tempo real
              </p>
            </div>
            {pos && (
              <button
                data-no-drag
                onClick={resetPosition}
                title="Restaurar posição padrão"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {msgs.length > 0 && (
              <button
                data-no-drag
                onClick={() => setMsgs([])}
                title="Nova conversa"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              data-no-drag
              onClick={() => setOpen(false)}
              title="Minimizar"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-200"
              aria-label="Minimizar"
            >
              <Minus className="h-5 w-5" />
            </button>
          </header>

          {/* Conversa */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <Welcome onPick={send} userName={userName} />
            )}

            {msgs.map((m, i) => (
              <MessageRow key={i} msg={m} />
            ))}

            {busy &&
              (msgs[msgs.length - 1]?.role !== "assistant" || status) && (
                <TypingIndicator status={status} />
              )}
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
    </div>
  );
}

// --------------------------------------------------------------------------
function Welcome({
  onPick,
  userName,
}: {
  onPick: (q: string) => void;
  userName?: string;
}) {
  return (
    <div className="pt-2">
      <div className="mb-3 flex items-center gap-3">
        <div className="chippy-bob grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-500/25">
          <MrChippy className="h-9 w-9" mood="happy" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {greeting(userName)} Sou o Mr. Chippy. 🐾
          </p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Seu companheiro de bordo nesta jornada.
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pergunte em linguagem natural — eu navego pelos dados reais do seu
        negócio e respondo com números, tabelas e análises. Também aponto
        oportunidades pelo caminho. Pode começar por uma destas rotas:
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
      <p className="mt-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Novo por aqui? É só perguntar &ldquo;como faço uma venda?&rdquo; ou
        &ldquo;como cadastro um produto?&rdquo; — eu te oriento passo a passo. ⚓
      </p>
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
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/20">
        <MrChippy className="h-5 w-5" mood="happy" />
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

function TypingIndicator({ status }: { status?: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/20">
        <MrChippy className="chippy-bob h-5 w-5" mood="thinking" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 dark:bg-ink-800">
        {status ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {status}
          </span>
        ) : null}
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
