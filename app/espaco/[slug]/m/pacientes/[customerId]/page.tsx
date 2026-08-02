import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  TrendingUp,
  FileText,
  Salad,
  FileSpreadsheet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getPatient } from "@/lib/endurance/pacientes";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule } from "@/lib/endurance/permissions";
import { sessionHasPermission } from "@/lib/auth";
import { loadModule, DeniedModule } from "../../module-kit";
import PatientForm from "./patient-form";
import AttachmentsPanel from "./attachments-panel";

/**
 * Módulos que trabalham sobre a ficha do paciente e aceitam o customerId na
 * rota. A ficha é o ponto de partida natural do atendimento, então dá acesso
 * direto a eles — sem obrigar o usuário a voltar ao menu e buscar o paciente de
 * novo em cada módulo.
 */
const RELATED: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "prontuario", label: "Prontuário", icon: ClipboardList },
  { id: "evolucao", label: "Evolução", icon: TrendingUp },
  { id: "anamnese", label: "Anamnese", icon: FileText },
  { id: "planos_alimentares", label: "Plano alimentar", icon: Salad },
];

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
  const [patient, ws] = await Promise.all([
    !isNew && session ? getPatient(session.org, customerId) : null,
    getWorkspace(slug),
  ]);
  if (!isNew && !patient) notFound();

  // Só oferece o que o espaço tem ligado E o perfil pode abrir — um atalho que
  // leva a "Acesso restrito" ou a 404 seria pior do que não existir.
  const active = new Set((ws?.modules ?? []).map((m) => m.id));
  const related = session
    ? RELATED.filter(
        (r) =>
          active.has(r.id) &&
          canAccessModule(session.role, session.permissions, r.id),
      )
    : [];
  // O resumo imprimível é conteúdo clínico: a página exige `prontuario.manage`.
  const canSummary = session
    ? sessionHasPermission(session, "prontuario.manage")
    : false;

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

      {!isNew && patient && related.length > 0 && (
        <nav
          aria-label="Atendimento do paciente"
          className="flex flex-wrap gap-2"
        >
          {related.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.id}
                href={`/espaco/${slug}/m/${r.id}/${patient.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-300"
              >
                <Icon className="h-4 w-4" /> {r.label}
              </Link>
            );
          })}
          {canSummary && (
            <Link
              href={`/espaco/${slug}/paciente-resumo/${patient.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-300"
            >
              <FileSpreadsheet className="h-4 w-4" /> Resumo
            </Link>
          )}
        </nav>
      )}

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
