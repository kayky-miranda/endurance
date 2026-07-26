import { Users, UserCheck, UserX, PauseCircle } from "lucide-react";
import { listStudents } from "@/lib/endurance/alunos";
import { loadModule, DeniedModule, ModuleHeader, KpiCard } from "../module-kit";
import AlunosClient from "./alunos-client";

/** Cadastro de alunos (academia) — lista, filtro por situação e ficha. */
export default async function AlunosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string; busca?: string; situacao?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "alunos");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await listStudents(session.org, {
        pagina: sp.pagina,
        term: sp.busca,
        status: sp.situacao,
      })
    : null;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Users}
              label="Total de alunos"
              value={String(data.counts.ativo + data.counts.inativo + data.counts.trancado)}
              from="from-cyan-500"
            />
            <KpiCard
              icon={UserCheck}
              label="Ativos"
              value={String(data.counts.ativo)}
              from="from-emerald-500"
            />
            <KpiCard
              icon={PauseCircle}
              label="Trancados"
              value={String(data.counts.trancado)}
              from="from-amber-500"
            />
            <KpiCard
              icon={UserX}
              label="Inativos"
              value={String(data.counts.inativo)}
              from="from-rose-500"
            />
          </div>

          <AlunosClient
            slug={slug}
            students={data.students}
            meta={data.meta}
            search={sp.busca ?? ""}
            status={sp.situacao ?? ""}
          />
        </>
      )}
    </div>
  );
}
