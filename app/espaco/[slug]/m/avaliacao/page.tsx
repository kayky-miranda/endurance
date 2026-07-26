import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { listAssessmentPatients } from "@/lib/endurance/avaliacao";
import { loadModule, DeniedModule, ModuleHeader, EmptyCard } from "../module-kit";
import StudentSearch from "./student-search";

/** Avaliação física — alunos avaliados + busca para abrir/registrar. Academia. */
export default async function AvaliacaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "avaliacao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const patients = session ? await listAssessmentPatients(session.org) : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <StudentSearch slug={slug} />

      {patients.length === 0 ? (
        <EmptyCard>
          Nenhuma avaliação ainda. Busque um aluno acima para registrar a
          primeira avaliação física.
        </EmptyCard>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espaco/${slug}/m/avaliacao/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-ink-800"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.count} avaliação{p.count === 1 ? "" : "ões"}
                    {p.lastAt &&
                      ` · última em ${new Date(p.lastAt).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
