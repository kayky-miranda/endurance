import { notFound } from "next/navigation";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPatientRecord } from "@/lib/endurance/prontuario";
import { getPatient } from "@/lib/endurance/pacientes";
import { getPatientEvolution } from "@/lib/endurance/evolucao";
import { listMealPlans } from "@/lib/endurance/planos";
import { listPrescriptions } from "@/lib/endurance/prescriptions";
import { listCertificates } from "@/lib/endurance/certificates";
import { certificateKindLabel } from "@/lib/endurance/certificate";
import { ageFromBirth } from "@/lib/endurance/patient";
import { getLetterhead } from "@/lib/endurance/document-letterhead";
import { DocumentShell, DocSection, DocField } from "../../components/DocumentShell";
import PrintActions from "../../receita/[id]/print-actions";

/**
 * Resumo clínico do paciente — visão consolidada e imprimível reunindo dados,
 * últimas anotações (com CID), medições recentes, planos ativos e documentos.
 * Read-only; agrega serviços existentes (queries em paralelo). Gate
 * prontuario.manage (dado clínico).
 */
export default async function PatientSummaryPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const session = await requireOrgAccess(slug);
  if (!sessionHasPermission(session, "prontuario.manage")) notFound();

  const [letterhead, record, profile, evolution, plans, prescriptions, certificates] =
    await Promise.all([
      getLetterhead(session.org),
      getPatientRecord(session.org, customerId),
      getPatient(session.org, customerId),
      getPatientEvolution(session.org, customerId),
      listMealPlans(session.org, customerId),
      listPrescriptions(session.org, customerId),
      listCertificates(session.org, customerId),
    ]);

  if (!record) notFound();

  const age = profile?.birthDate ? ageFromBirth(new Date(profile.birthDate)) : null;
  const activePlans = plans.filter((p) => p.active);
  const latestMetrics = (evolution ?? [])
    .filter((s) => s.stats)
    .slice(0, 8)
    .map((s) => ({
      label: s.label,
      value: s.stats!.last,
      unit: s.unit,
      decimals: s.decimals,
    }));
  const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  const num = (n: number, d: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div>
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${customerId}`} />

      <DocumentShell
        letterhead={letterhead}
        title="Resumo do paciente"
        subtitle={record.name}
        signature={null}
      >
        <DocSection title="Identificação">
          <DocField label="Nome" value={record.name} />
          {record.document && <DocField label="CPF" value={record.document} />}
          {age !== null && <DocField label="Idade" value={`${age} anos`} />}
          {record.phone && <DocField label="Telefone" value={record.phone} />}
          {profile?.insuranceName && (
            <DocField label="Convênio" value={profile.insuranceName} />
          )}
        </DocSection>

        {latestMetrics.length > 0 && (
          <DocSection title="Medições recentes">
            {latestMetrics.map((m) => (
              <DocField
                key={m.label}
                label={m.label}
                value={`${num(m.value, m.decimals)} ${m.unit}`}
              />
            ))}
          </DocSection>
        )}

        {record.notes.length > 0 && (
          <DocSection title="Últimas anotações clínicas">
            {record.notes.slice(0, 5).map((n) => (
              <div key={n.id} className="doc-qa-item">
                <p className="doc-qa-q">
                  {dt(n.createdAt)}
                  {n.title ? ` · ${n.title}` : ""}
                  {n.cid ? ` · CID ${n.cid}` : ""}
                </p>
                <p className="doc-qa-a">{n.content}</p>
              </div>
            ))}
          </DocSection>
        )}

        {activePlans.length > 0 && (
          <DocSection title="Planos ativos">
            {activePlans.map((p) => (
              <p key={p.id} className="doc-qa-a">
                {p.title}
                {p.goal ? ` — ${p.goal}` : ""}
              </p>
            ))}
          </DocSection>
        )}

        {(prescriptions.length > 0 || certificates.length > 0) && (
          <DocSection title="Documentos recentes">
            {prescriptions.slice(0, 3).map((p) => (
              <p key={p.id} className="doc-qa-a">
                Receita · {dt(p.issuedAt)} · {p.itemsCount} medicamento(s)
                {p.cid ? ` · CID ${p.cid}` : ""}
              </p>
            ))}
            {certificates.slice(0, 3).map((c) => (
              <p key={c.id} className="doc-qa-a">
                Atestado ({certificateKindLabel(c.kind)}) · {dt(c.issuedAt)}
                {c.days ? ` · ${c.days} dia(s)` : ""}
              </p>
            ))}
          </DocSection>
        )}
      </DocumentShell>
    </div>
  );
}
