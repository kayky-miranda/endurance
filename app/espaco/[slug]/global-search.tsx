"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  UserRound,
  Users,
  Package,
  CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { globalSearchAction } from "./search-actions";
import type { SearchHit, SearchHitType } from "@/lib/endurance/global-search";

const TYPE_META: Record<SearchHitType, { icon: LucideIcon; label: string }> = {
  paciente: { icon: UserRound, label: "Paciente" },
  cliente: { icon: Users, label: "Cliente" },
  produto: { icon: Package, label: "Produto" },
  consulta: { icon: CalendarDays, label: "Consulta" },
};

/**
 * Busca global do topbar: encontra pacientes/clientes, produtos e consultas do
 * espaço. Debounce + navegação por teclado (↑/↓/Enter/Esc) e atalho Ctrl/⌘+K.
 * Todo o escopo e o gating rodam na server action; aqui é só a UX.
 */
export default function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // Debounce da busca; ignora respostas fora de ordem (seq).
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await globalSearchAction(q);
      if (mine !== seq.current) return; // uma busca mais nova já saiu
      setHits(res);
      setActive(0);
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Atalho Ctrl/⌘+K foca a busca.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setTerm("");
    setHits([]);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const h = hits[active];
      if (h) go(h);
    }
  }

  const showDropdown = open && term.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative hidden max-w-xs flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder="Buscar paciente, produto, consulta…"
        aria-label="Buscar"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-list"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-500 dark:border-ink-700 dark:bg-ink-950 dark:text-slate-200"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
      )}

      {showDropdown && (
        <div
          id="global-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-ink-700 dark:bg-ink-900"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              {loading ? "Buscando…" : "Nada encontrado."}
            </p>
          ) : (
            hits.map((h, i) => {
              const meta = TYPE_META[h.type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${h.type}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                    i === active
                      ? "bg-brand-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-ink-800"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                      {h.label}
                    </span>
                    {h.sub && (
                      <span className="block truncate text-[11px] text-slate-400">
                        {h.sub}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                    {meta.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
