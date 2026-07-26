"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, ChevronRight, UserRound } from "lucide-react";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { PatientRow } from "@/lib/endurance/pacientes";
import { formatCpf } from "@/lib/endurance/patient";
import Pager from "../pager";

export default function PatientsClient({
  slug,
  patients,
  meta,
  search,
}: {
  slug: string;
  patients: PatientRow[];
  meta: PageMeta;
  search: string;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const qs = term.trim() ? `?busca=${encodeURIComponent(term.trim())}` : "";
    router.push(`/espaco/${slug}/m/pacientes${qs}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF…"
            aria-label="Buscar paciente"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-ink-600 dark:bg-ink-900 dark:text-slate-100"
          />
        </form>
        <Link
          href={`/espaco/${slug}/m/pacientes/novo`}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Novo paciente
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum paciente encontrado. Clique em <strong>Novo paciente</strong> para
            cadastrar a ficha completa.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espaco/${slug}/m/pacientes/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-ink-800"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[p.cpf ? formatCpf(p.cpf) : null, p.phone, p.city]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                {p.insuranceName && (
                  <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-ink-800 sm:inline">
                    {p.insuranceName}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pager param="pagina" meta={meta} />
    </div>
  );
}
