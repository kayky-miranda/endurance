import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPatientPlansFull } from "@/lib/endurance/planos";
import { prisma } from "@/lib/db";
import { loadModule, DeniedModule } from "../../module-kit";
import PlansClient from "./plans-client";

/** Planos alimentares de um paciente: lista + editor de cardápio. */
export default async function PatientPlansPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "planos_alimentares");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getPatientPlansFull(session.org, customerId)
    : { patientExists: false, plans: [] };
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
          href={`/espaco/${slug}/m/planos_alimentares`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Planos alimentares
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {customer?.name ?? "Paciente"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cardápios e planos alimentares do paciente.
        </p>
      </div>

      <PlansClient slug={slug} customerId={customerId} plans={data.plans} />
    </div>
  );
}
