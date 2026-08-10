import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { getEstablishmentWizard } from "@/lib/endurance/establishment";
import ReadinessPanel from "../m/readiness-panel";
import CertificateCard from "../m/certificate-card";
import WizardClient from "./wizard-client";

/**
 * Cadastro do estabelecimento em etapas.
 *
 * Vive fora do módulo Fiscal porque não é só fiscal: identificação jurídica,
 * endereço e responsável legal servem a documento impresso, contrato e
 * cobrança. O fiscal é um consumidor desse cadastro, não o dono dele.
 *
 * Gate `fiscal.manage` — os campos aqui definem em nome de quem os documentos
 * saem, e o CSC é segredo de emissão.
 */
export const dynamic = "force-dynamic";

export default async function EstabelecimentoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!sessionHasPermission(session, "fiscal.manage"))
    redirect(`/espaco/${slug}`);

  const { data, steps, readiness, percent, resumeAt } =
    await getEstablishmentWizard(session.org);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Visão geral
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Building2 className="h-6 w-6 text-brand-500" />
          Estabelecimento
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Dados da empresa usados em documentos, notas fiscais e cobrança.
          Preencha por etapas — cada uma salva sozinha.
        </p>
      </div>

      <WizardClient
        data={data}
        steps={steps}
        percent={percent}
        resumeAt={resumeAt}
        readinessPanel={
          <ReadinessPanel docs={readiness.docs} status={readiness.status} />
        }
        certificatePanel={
          <CertificateCard
            validoAte={data.certValidoAte}
            habilitado={data.certHabilitado}
          />
        }
      />
    </div>
  );
}
