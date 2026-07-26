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

  const [org, record, profile, evolution, plans, prescriptions, certificates] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: session.org },
        select: { name: true, city: true, state: true },
      }),
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
    <div className="mx-auto max-w-[720px] px-4 py-6 text-slate-900">
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${customerId}`} />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 print:border-0 print:p-0">
        <header className="border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-bold">{org?.name ?? "Clínica"}</h1>
          {(org?.city || org?.state) && (
            <p className="text-xs text-slate-500">{[org?.city, org?.state].filter(Boolean).join(" / ")}</p>
          )}
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Resumo do paciente
          </p>
        </header>

        {/* Identificação */}
        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p className="col-span-2"><span className="text-slate-500">Nome:</span> <strong>{record.name}</strong></p>
          {record.document && <p><span className="text-slate-500">CPF:</span> {record.document}</p>}
          {age !== null && <p><span className="text-slate-500">Idade:</span> {age} anos</p>}
          {record.phone && <p><span className="text-slate-500">Telefone:</span> {record.phone}</p>}
          {profile?.insuranceName && <p><span className="text-slate-500">Convênio:</span> {profile.insuranceName}</p>}
        </section>

        {/* Medições recentes */}
        {latestMetrics.length > 0 && (
          <SummarySection title="Medições recentes">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {latestMetrics.map((m) => (
                <p key={m.label}>
                  <span className="text-slate-500">{m.label}:</span> {num(m.value, m.decimals)} {m.unit}
                </p>
              ))}
            </div>
          </SummarySection>
        )}

        {/* Últimas anotações */}
        {record.notes.length > 0 && (
          <SummarySection title="Últimas anotações clínicas">
            <ul className="space-y-2 text-sm">
              {record.notes.slice(0, 5).map((n) => (
                <li key={n.id} className="border-b border-dashed border-slate-200 pb-2">
                  <p className="text-xs text-slate-500">
                    {dt(n.createdAt)}
                    {n.title ? ` · ${n.title}` : ""}
                    {n.cid ? ` · CID ${n.cid}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700">{n.content}</p>
                </li>
              ))}
            </ul>
          </SummarySection>
        )}

        {/* Planos ativos */}
        {activePlans.length > 0 && (
          <SummarySection title="Planos ativos">
            <ul className="list-inside list-disc text-sm text-slate-700">
              {activePlans.map((p) => (
                <li key={p.id}>{p.title}{p.goal ? ` — ${p.goal}` : ""}</li>
              ))}
            </ul>
          </SummarySection>
        )}

        {/* Documentos recentes */}
        {(prescriptions.length > 0 || certificates.length > 0) && (
          <SummarySection title="Documentos recentes">
            <ul className="space-y-1 text-sm text-slate-700">
              {prescriptions.slice(0, 3).map((p) => (
                <li key={p.id}>Receita · {dt(p.issuedAt)} · {p.itemsCount} medicamento(s){p.cid ? ` · CID ${p.cid}` : ""}</li>
              ))}
              {certificates.slice(0, 3).map((c) => (
                <li key={c.id}>Atestado ({certificateKindLabel(c.kind)}) · {dt(c.issuedAt)}{c.days ? ` · ${c.days} dia(s)` : ""}</li>
              ))}
            </ul>
          </SummarySection>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Gerado em {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}
