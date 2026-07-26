import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPatientAssessments } from "@/lib/endurance/avaliacao";
import { prisma } from "@/lib/db";
import { loadModule, DeniedModule } from "../../module-kit";
import AvaliacaoClient from "./avaliacao-client";

/** Avaliações físicas de um aluno: comparação no tempo + registro. */
export default async function StudentAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "avaliacao");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getPatientAssessments(session.org, customerId)
    : { patientExists: false, assessments: [] };
  if (!data.patientExists) notFound();

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
          href={`/espaco/${slug}/m/avaliacao`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Avaliação física
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {customer?.name ?? "Aluno"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Avaliações físicas e evolução das medidas.
        </p>
      </div>

      <AvaliacaoClient
        customerId={customerId}
        assessments={data.assessments}
      />
    </div>
  );
}
