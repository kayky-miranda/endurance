import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, IdCard } from "lucide-react";
import { getPatientRecord } from "@/lib/endurance/prontuario";
import { listPrescriptions } from "@/lib/endurance/prescriptions";
import { listCertificates } from "@/lib/endurance/certificates";
import { listProfessionals } from "@/lib/endurance/agenda";
import { loadModule, DeniedModule } from "../../module-kit";
import RecordClient from "./record-client";
import PrescriptionsPanel from "./prescriptions-panel";
import CertificatesPanel from "./certificates-panel";

/** Prontuário de um paciente: dados + timeline de anotações + editor. */
export default async function PatientRecordPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "prontuario");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const record = session
    ? await getPatientRecord(session.org, customerId)
    : null;
  if (!record) notFound();

  const [prescriptions, certificates, professionals] = session
    ? await Promise.all([
        listPrescriptions(session.org, customerId),
        listCertificates(session.org, customerId),
        listProfessionals(session.org),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}/m/prontuario`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Prontuários
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{record.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {record.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {record.phone}
            </span>
          )}
          {record.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {record.email}
            </span>
          )}
          {record.document && (
            <span className="inline-flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5" /> {record.document}
            </span>
          )}
        </div>
      </div>

      <RecordClient slug={slug} customerId={record.id} notes={record.notes} />

      <PrescriptionsPanel
        slug={slug}
        customerId={record.id}
        prescriptions={prescriptions}
        professionals={professionals}
      />

      <CertificatesPanel
        slug={slug}
        customerId={record.id}
        certificates={certificates}
        professionals={professionals}
      />
    </div>
  );
}
