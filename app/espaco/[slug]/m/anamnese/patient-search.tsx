"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { searchPatientsAction, type PatientHit } from "./anamnese-actions";

/** Busca de paciente para abrir/preencher a anamnese. */
export default function PatientSearch({ slug }: { slug: string }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setTerm(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await searchPatientsAction(v);
      setHits(res);
      setOpen(true);
      setLoading(false);
    }, 250);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="relative">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={term}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Buscar paciente por nome ou telefone…"
          aria-label="Buscar paciente"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm dark:border-ink-600 dark:bg-ink-900 dark:text-slate-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </label>

      {open && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-ink-600 dark:bg-ink-900">
          {hits.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-slate-400">
              Nenhum paciente encontrado.
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/espaco/${slug}/m/anamnese/${h.id}`)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-800"
                >
                  <span className="text-slate-700 dark:text-slate-200">{h.name}</span>
                  <span className="text-xs text-slate-400">{h.phone}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
