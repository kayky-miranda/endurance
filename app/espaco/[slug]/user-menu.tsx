"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { logoutAction } from "@/app/actions";

/**
 * Menu suspenso da conta, acionado pelo avatar no cabeçalho. Reúne os atalhos
 * "Minha conta", "Configurações" e "Sair". O logout reusa a server action
 * `logoutAction` (mesma do rodapé da sidebar) — sem duplicar lógica.
 */
export default function UserMenu({
  slug,
  userName,
  userEmail,
}: {
  slug: string;
  userName: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (userName || "?").trim().charAt(0).toUpperCase();
  const base = `/espaco/${slug}`;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative pl-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-ink-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-ink-950">
          {initial}
        </div>
        <span className="hidden text-sm font-medium sm:inline">{userName}</span>
        <ChevronDown
          className={`hidden h-4 w-4 text-slate-400 transition sm:inline ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-ink-800">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-ink-950">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {userName}
              </p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>

          <div className="p-1.5">
            <Link
              href={`${base}/conta`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-ink-800"
            >
              <User className="h-4 w-4 text-slate-400" />
              Minha conta
            </Link>
            <Link
              href={`${base}/configuracoes`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-ink-800"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              Configurações
            </Link>
          </div>

          <div className="border-t border-slate-100 p-1.5 dark:border-ink-800">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
