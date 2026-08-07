import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getCertificate,
  certificateKindLabel,
} from "@/lib/endurance/certificates";
import {
  getLetterhead,
  getRecordedSignature,
} from "@/lib/endurance/document-letterhead";
import { DocumentShell, DocSection, DocField } from "../../components/DocumentShell";
import PrintActions from "../../receita/[id]/print-actions";

/**
 * Atestado imprimível. Ver a nota em `receita/[id]/page.tsx`: usava cabeçalho
 * próprio e agora sai no mesmo papel timbrado dos demais documentos.
 */
export default async function AtestadoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await requireOrgAccess(slug);

  const c = await getCertificate(session.org, id);
  if (!c) notFound();

  const [letterhead, signature, customer] = await Promise.all([
    getLetterhead(session.org),
    getRecordedSignature(session.org, session.sub, {
      name: c.professional ?? "",
      council: c.professionalCouncil ?? "",
    }),
    prisma.customer.findFirst({
      where: { id: c.customerId, organizationId: session.org },
      select: { name: true, document: true },
    }),
  ]);

  // Texto padrão quando o profissional não escreveu um corpo.
  const body =
    c.text ||
    defaultBody(c.kind, customer?.name ?? "o(a) paciente", c.days, c.startDate);

  return (
    <div>
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${c.customerId}`} />

      <DocumentShell
        letterhead={letterhead}
        title={`Atestado ${certificateKindLabel(c.kind)}`}
        subtitle={customer?.name ?? undefined}
        signature={signature}
        issuedAt={new Date(c.issuedAt)}
      >
        <p className="doc-paragraph doc-prewrap">{body}</p>

        {(c.cid || customer?.document) && (
          <DocSection>
            {c.cid && (
              <DocField
                label="CID"
                value={`${c.cid}${c.cidDescription ? ` — ${c.cidDescription}` : ""}`}
              />
            )}
            {customer?.document && (
              <DocField label="CPF" value={customer.document} />
            )}
          </DocSection>
        )}
      </DocumentShell>
    </div>
  );
}

function defaultBody(
  kind: string,
  name: string,
  days: number | null,
  startDate: string | null,
): string {
  if (kind === "afastamento") {
    const d = days && days > 0 ? `${days} dia(s)` : "o período necessário";
    const inicio = startDate
      ? ` a partir de ${new Date(startDate).toLocaleDateString("pt-BR")}`
      : "";
    return `Atesto, para os devidos fins, que ${name} necessita de afastamento de suas atividades por ${d}${inicio}, por motivo de saúde.`;
  }
  if (kind === "comparecimento") {
    return `Atesto, para os devidos fins, que ${name} compareceu a esta unidade para atendimento na data de hoje.`;
  }
  return `Atesto, para os devidos fins, referente a ${name}.`;
}
