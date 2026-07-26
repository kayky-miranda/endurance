import Link from "next/link";
import { Dumbbell, ChevronRight, CheckCircle2 } from "lucide-react";
import { listWorkoutPatients } from "@/lib/endurance/treinos";
import { loadModule, DeniedModule, ModuleHeader, EmptyCard } from "../module-kit";
import StudentSearch from "./student-search";

/** Fichas de treino — alunos com treino + busca para abrir/criar. Academia. */
export default async function TreinosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "treinos");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const patients = session ? await listWorkoutPatients(session.org) : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <StudentSearch slug={slug} />

      {patients.length === 0 ? (
        <EmptyCard>
          Nenhuma ficha de treino ainda. Busque um aluno acima para montar o
          primeiro treino.
        </EmptyCard>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espaco/${slug}/m/treinos/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-ink-800"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Dumbbell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.plans} ficha{p.plans === 1 ? "" : "s"}
                    {p.lastAt &&
                      ` · atualizada em ${new Date(p.lastAt).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                {p.hasActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> ativa
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
