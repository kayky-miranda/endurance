import Link from "next/link";
import { FileText, ChevronRight, ShieldCheck } from "lucide-react";
import { listPatients } from "@/lib/endurance/prontuario";
import { listTemplates } from "@/lib/endurance/document-templates";
import { loadModule, DeniedModule, ModuleHeader, EmptyCard } from "../module-kit";
import Pager from "../pager";
import PatientSearch from "./patient-search";
import TemplatesManager from "./templates-manager";

/**
 * Prontuário clínico — lista de pacientes com registro e busca para abrir/
 * iniciar um prontuário. Dado sensível: gate prontuario.manage.
 */
export default async function ProntuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "prontuario");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const [data, templates] = session
    ? await Promise.all([
        listPatients(session.org, { page: sp.pagina }),
        listTemplates(session.org),
      ])
    : [null, []];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-500/5 px-4 py-3 text-xs text-slate-600 dark:border-brand-500/20 dark:text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        <p>
          As anotações são <strong>confidenciais</strong> e visíveis apenas para
          quem tem a permissão de Prontuário clínico. Todo acesso de escrita é
          auditado.
        </p>
      </div>

      <PatientSearch slug={slug} />

      <TemplatesManager templates={templates} />

      {!data || data.total === 0 ? (
        <EmptyCard>
          Nenhum prontuário ainda. Use a busca acima para encontrar um paciente
          e registrar a primeira anotação clínica.
        </EmptyCard>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-ink-800 dark:border-ink-700 dark:bg-ink-900">
            {data.patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/espaco/${slug}/m/prontuario/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-ink-800"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.notes} anotação{p.notes === 1 ? "" : "ões"}
                      {p.lastNote &&
                        ` · última em ${new Date(p.lastNote).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
          <Pager param="pagina" meta={data.meta} />
        </>
      )}
    </div>
  );
}
