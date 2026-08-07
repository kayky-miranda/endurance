import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPatientWorkoutsFull } from "@/lib/endurance/treinos";
import { prisma } from "@/lib/db";
import { canAccessModule } from "@/lib/endurance/permissions";
import { documentsFor } from "@/lib/endurance/document-catalog";
import { loadModule, DeniedModule } from "../../module-kit";
import PrintMenu from "../../../components/PrintMenu";
import TreinosClient from "./treinos-client";

/** Fichas de treino de um aluno: visualização + editor. */
export default async function StudentWorkoutsPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "treinos");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getPatientWorkoutsFull(session.org, customerId)
    : { patientExists: false, workouts: [] };
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
          href={`/espaco/${slug}/m/treinos`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Fichas de treino
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {customer?.name ?? "Aluno"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Treinos por divisão (A/B/C) do aluno.
            </p>
          </div>
          <PrintMenu
            slug={slug}
            customerId={customerId}
            available={
              session
                ? documentsFor((m) =>
                    canAccessModule(session.role, session.permissions, m),
                  )
                : []
            }
            ownerModule="treinos"
          />
        </div>
      </div>

      <TreinosClient slug={slug} customerId={customerId} workouts={data.workouts} />
    </div>
  );
}
