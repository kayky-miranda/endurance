"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortState } from "@/lib/endurance/sorting";

/**
 * Cabeçalho de coluna ordenável (ordenação SERVER-SIDE via URL).
 *
 * Estado na querystring (`?ord=campo&dir=asc|desc`), no mesmo padrão da busca
 * e da paginação: a ordenação roda no banco, a URL fica compartilhável e o
 * botão Voltar do navegador funciona. Clicar alterna asc → desc → sem ordem.
 */

// O parse (whitelist) vive em lib/endurance/sorting.ts — lógica pura, sem
// JSX, testada isoladamente. Aqui fica só o cabeçalho clicável.
export type { SortState };

export function SortableTh({
  field,
  label,
  sort,
  align = "left",
  className = "",
}: {
  field: string;
  label: string;
  sort: SortState;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = sort.field === field;

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    // asc → desc → volta ao padrão (remove a ordenação explícita)
    if (!active) {
      params.set("ord", field);
      params.set("dir", "asc");
    } else if (sort.dir === "asc") {
      params.set("ord", field);
      params.set("dir", "desc");
    } else {
      params.delete("ord");
      params.delete("dir");
    }
    params.delete("pagina"); // nova ordem recomeça na primeira página
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  const justify =
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "";

  return (
    <th className={`px-5 py-2.5 font-medium ${className}`}>
      <button
        onClick={toggle}
        aria-label={`Ordenar por ${label}`}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`group inline-flex w-full items-center gap-1 uppercase tracking-wider transition hover:text-brand-500 ${justify} ${
          active ? "text-brand-600 dark:text-brand-300" : ""
        }`}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-0 transition group-hover:opacity-50" />
        )}
      </button>
    </th>
  );
}
