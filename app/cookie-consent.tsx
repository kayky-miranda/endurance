"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

/**
 * Banner de consentimento de cookies. LGPD não exige banner para cookies
 * estritamente necessários (sessão, anti-CSRF) — só para analytics/marketing.
 *
 * A escolha vai pro cookie `endurance:cookie-consent` (1 ano), valores:
 *   "all" → aceitou todos (essenciais + análise)
 *   "essential" → só essenciais
 *
 * Sem cookie = não exibimos analytics até o usuário escolher.
 */

const COOKIE_NAME = "endurance:cookie-consent";
const ONE_YEAR_SEC = 365 * 24 * 60 * 60;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^| )${COOKIE_NAME}=([^;]+)`));
  return m ? m[1] : null;
}

function writeCookie(value: "all" | "essential") {
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${ONE_YEAR_SEC}; Path=/; SameSite=Lax`;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readCookie()) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept(kind: "all" | "essential") {
    writeCookie(kind);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-2xl rounded-2xl border border-ink-700 bg-ink-900/95 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">Usamos cookies neste site</p>
          <p className="mt-1 leading-relaxed text-slate-400">
            Cookies essenciais mantêm sua sessão e suas preferências. Os de análise nos ajudam a entender o uso da plataforma e melhorar a experiência. Você pode aceitar todos ou só os essenciais.{" "}
            <Link
              href="/privacidade"
              className="text-cyan-300 underline-offset-2 hover:underline"
            >
              Saiba mais
            </Link>
            .
          </p>
        </div>
        <button
          onClick={() => accept("essential")}
          aria-label="Fechar"
          className="rounded-lg p-1 text-slate-500 hover:bg-ink-800 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => accept("essential")}
          className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-ink-800"
        >
          Só essenciais
        </button>
        <button
          onClick={() => accept("all")}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-ink-950 hover:bg-cyan-400"
        >
          Aceitar todos
        </button>
      </div>
    </div>
  );
}
