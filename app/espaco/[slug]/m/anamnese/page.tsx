import Link from "next/link";
import { ClipboardList, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { listAnamnesePatients } from "@/lib/endurance/anamnese";
import { loadModule, DeniedModule, ModuleHeader, EmptyCard } from "../module-kit";
import PatientSearch from "./patient-search";

/**
 * Anamnese — pacientes com questionário + busca para abrir/preencher. Nichos de
 * saúde (gate anamnese.manage).
 */
export default async function AnamnesePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "anamnese");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const patients = session ? await listAnamnesePatients(session.org) : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <PatientSearch slug={slug} />

      {patients.length === 0 ? (
        <EmptyCard>
          Nenhuma anamnese ainda. Busque um paciente acima para preencher o
          questionário inicial.
        </EmptyCard>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espaco/${slug}/m/anamnese/${p.id}`}
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
                    atualizada em {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {p.status === "concluida" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> concluída
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                    <Clock className="h-3 w-3" /> rascunho
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
