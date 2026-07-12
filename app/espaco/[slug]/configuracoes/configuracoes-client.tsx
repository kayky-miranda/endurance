"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Preferências do usuário. A aparência (tema) compartilha a mesma fonte de
 * verdade do Shell — localStorage "endurance-theme" — e avisa o Shell ao vivo
 * pelo evento "endurance:set-theme", sem exigir reload.
 */
export default function ConfiguracoesClient() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(localStorage.getItem("endurance-theme") === "dark");
  }, []);

  function applyTheme(next: boolean) {
    setDark(next);
    localStorage.setItem("endurance-theme", next ? "dark" : "light");
    window.dispatchEvent(
      new CustomEvent("endurance:set-theme", { detail: { dark: next } }),
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Aparência</h2>
      <p className="mt-1 text-xs text-slate-500">Escolha como o painel é exibido.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <ThemeCard
          active={dark === false}
          onClick={() => applyTheme(false)}
          icon={<Sun className="h-5 w-5" />}
          label="Claro"
        />
        <ThemeCard
          active={dark === true}
          onClick={() => applyTheme(true)}
          icon={<Moon className="h-5 w-5" />}
          label="Escuro"
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm dark:border-ink-800">
        <span className="text-slate-500">Idioma</span>
        <span className="text-slate-800 dark:text-slate-200">Português (Brasil)</span>
      </div>
    </section>
  );
}

function ThemeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-300"
          : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-ink-700 dark:text-slate-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
