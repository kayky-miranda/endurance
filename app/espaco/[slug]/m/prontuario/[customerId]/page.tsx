import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, IdCard, FileText } from "lucide-react";
import { getPatientRecord } from "@/lib/endurance/prontuario";
import { listPrescriptions } from "@/lib/endurance/prescriptions";
import { listCertificates } from "@/lib/endurance/certificates";
import { listTemplates } from "@/lib/endurance/document-templates";
import { listProfessionals } from "@/lib/endurance/agenda";
import { getPatientBriefing } from "@/lib/endurance/patient-briefing";
import { getPatientExams } from "@/lib/endurance/lab-exams";
import { documentsFor } from "@/lib/endurance/document-catalog";
import { canAccessModule } from "@/lib/endurance/permissions";
import { loadModule, DeniedModule } from "../../module-kit";
import RecordClient from "./record-client";
import BriefingPanel from "./briefing-panel";
import ExamsPanel from "./exams-panel";
import DocumentsPanel from "./documents-panel";
import ClinicalAnalysisPanel from "./clinical-analysis-panel";
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

  const [prescriptions, certificates, noteTemplates, professionals, briefing, exams] = session
    ? await Promise.all([
        listPrescriptions(session.org, customerId),
        listCertificates(session.org, customerId),
        listTemplates(session.org, { type: "nota" }),
        listProfessionals(session.org),
        getPatientBriefing(session.org, customerId),
        getPatientExams(session.org, customerId),
      ])
    : [[], [], [], [], null, null];

  // Só oferece o documento cujo módulo o perfil pode acessar.
  const availableDocs = session
    ? documentsFor((m) => canAccessModule(session.role, session.permissions, m))
    : [];

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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{record.name}</h1>
          <a
            href={`/espaco/${slug}/paciente-resumo/${record.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
          >
            <FileText className="h-3.5 w-3.5" /> Resumo (imprimir)
          </a>
        </div>
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

      {briefing && <BriefingPanel briefing={briefing} />}

      <ClinicalAnalysisPanel slug={slug} customerId={record.id} />

      {exams && <ExamsPanel slug={slug} customerId={record.id} data={exams} />}

      <DocumentsPanel slug={slug} customerId={record.id} available={availableDocs} />

      <RecordClient slug={slug} customerId={record.id} notes={record.notes} templates={noteTemplates} />

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
