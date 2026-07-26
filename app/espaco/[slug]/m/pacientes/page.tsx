import { listPatients } from "@/lib/endurance/pacientes";
import { loadModule, DeniedModule, ModuleHeader } from "../module-kit";
import PatientsClient from "./patients-client";

/** Cadastro de pacientes — lista + busca + acesso à ficha completa. */
export default async function PacientesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string; busca?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "pacientes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await listPatients(session.org, { pagina: sp.pagina, term: sp.busca })
    : null;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {data && (
        <PatientsClient
          slug={slug}
          patients={data.patients}
          meta={data.meta}
          search={sp.busca ?? ""}
        />
      )}
    </div>
  );
}
