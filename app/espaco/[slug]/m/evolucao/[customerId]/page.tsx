import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPatientEvolution } from "@/lib/endurance/evolucao";
import { prisma } from "@/lib/db";
import { loadModule, DeniedModule } from "../../module-kit";
import EvolucaoClient from "./evolucao-client";

/** Evolução de um paciente: séries por indicador + registro de medições. */
export default async function PatientEvolutionPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "evolucao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const series = session
    ? await getPatientEvolution(session.org, customerId)
    : null;
  if (series === null) notFound();

  const customer = session
    ? await prisma.customer.findFirst({
        where: { id: customerId, organizationId: session.org },
        select: { name: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}/m/evolucao`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Evolução
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {customer?.name ?? "Paciente"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Acompanhamento de indicadores ao longo do tempo.
        </p>
      </div>

      <EvolucaoClient slug={slug} customerId={customerId} series={series} />
    </div>
  );
}
