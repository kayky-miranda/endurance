import Link from "next/link";
import { TrendingUp, ChevronRight, Activity } from "lucide-react";
import { listEvolutionPatients } from "@/lib/endurance/evolucao";
import { loadModule, DeniedModule, ModuleHeader, EmptyCard } from "../module-kit";
import PatientSearch from "./patient-search";

/**
 * Evolução do paciente — pacientes com acompanhamento + busca para abrir/iniciar
 * uma série de medições. Serve os nichos de saúde (gate evolucao.manage).
 */
export default async function EvolucaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { mod, session, denied } = await loadModule(slug, "evolucao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const patients = session ? await listEvolutionPatients(session.org) : [];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <PatientSearch slug={slug} />

      {patients.length === 0 ? (
        <EmptyCard>
          Nenhum acompanhamento ainda. Busque um paciente acima para registrar a
          primeira medição (peso, medidas, escalas…).
        </EmptyCard>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espaco/${slug}/m/evolucao/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-ink-800"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.metrics} indicador{p.metrics === 1 ? "" : "es"} ·{" "}
                    {p.measurements} medição{p.measurements === 1 ? "" : "ões"}
                    {p.lastAt &&
                      ` · última em ${new Date(p.lastAt).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 shrink-0 text-slate-300" />
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
