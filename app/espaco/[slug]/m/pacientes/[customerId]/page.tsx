import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPatient } from "@/lib/endurance/pacientes";
import { loadModule, DeniedModule } from "../../module-kit";
import PatientForm from "./patient-form";
import AttachmentsPanel from "./attachments-panel";

/** Ficha do paciente — criação (id "novo") ou edição + anexos. */
export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "pacientes");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const isNew = customerId === "novo";
  const patient = !isNew && session ? await getPatient(session.org, customerId) : null;
  if (!isNew && !patient) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}/m/pacientes`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Pacientes
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {isNew ? "Novo paciente" : patient!.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isNew ? "Cadastre a ficha completa do paciente." : "Ficha do paciente."}
        </p>
      </div>

      <PatientForm slug={slug} patient={patient} />

      {!isNew && patient && (
        <AttachmentsPanel
          slug={slug}
          customerId={patient.id}
          attachments={patient.attachments}
        />
      )}
    </div>
  );
}
