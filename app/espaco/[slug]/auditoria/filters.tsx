"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { AUDIT_DOMAINS } from "@/lib/endurance/audit-taxonomy";

/**
 * Filtros da trilha. O estado vive na URL, não no componente: a consulta roda
 * no servidor (a tabela pode ter centenas de milhares de linhas) e um filtro na
 * URL é compartilhável — "olha o que aconteceu nesse dia" vira um link.
 */
export default function AuditFilters({
  actors,
}: {
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") ?? "");

  // Busca com atraso: sem isso cada tecla dispara uma consulta ao banco.
  useEffect(() => {
    const atual = search.get("q") ?? "";
    if (q === atual) return;
    const t = setTimeout(() => set("q", q), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function set(key: string, value: string) {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("pagina"); // filtro novo sempre volta para a primeira página
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const selCls =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-200";
  const filtrando =
    !!search.get("q") ||
    !!search.get("dominio") ||
    !!search.get("autor") ||
    !!search.get("dias");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descrição, ação ou pessoa…"
          aria-label="Buscar na trilha"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-ink-600 dark:bg-ink-900 dark:text-slate-100"
        />
      </div>

      <select
        value={search.get("dominio") ?? ""}
        onChange={(e) => set("dominio", e.target.value)}
        aria-label="Área"
        className={selCls}
      >
        <option value="">Todas as áreas</option>
        {AUDIT_DOMAINS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>

      <select
        value={search.get("autor") ?? ""}
        onChange={(e) => set("autor", e.target.value)}
        aria-label="Quem executou"
        className={selCls}
      >
        <option value="">Qualquer pessoa</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <select
        value={search.get("dias") ?? "90"}
        onChange={(e) => set("dias", e.target.value === "90" ? "" : e.target.value)}
        aria-label="Período"
        className={selCls}
      >
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="365">Último ano</option>
      </select>

      {filtrando && (
        <button
          onClick={() => {
            setQ("");
            router.replace(pathname, { scroll: false });
          }}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-brand-500"
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </button>
      )}
    </div>
  );
}
