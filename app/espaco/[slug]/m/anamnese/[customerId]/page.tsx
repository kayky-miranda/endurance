import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrInitAnamnese } from "@/lib/endurance/anamnese";
import { prisma } from "@/lib/db";
import { loadModule, DeniedModule } from "../../module-kit";
import AnamneseClient from "./anamnese-client";

/** Anamnese de um paciente: preenchimento/edição do questionário. */
export default async function PatientAnamnesePage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "anamnese");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getOrInitAnamnese(session.org, customerId)
    : null;
  if (data === null) notFound();

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
          href={`/espaco/${slug}/m/anamnese`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Anamnese
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {customer?.name ?? "Paciente"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Questionário inicial do paciente.
        </p>
      </div>

      <AnamneseClient slug={slug} customerId={customerId} data={data} />
    </div>
  );
}
