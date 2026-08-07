import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrescription } from "@/lib/endurance/prescriptions";
import {
  getLetterhead,
  getRecordedSignature,
} from "@/lib/endurance/document-letterhead";
import {
  DocumentShell,
  DocSection,
  DocField,
} from "../../components/DocumentShell";
import PrintActions from "./print-actions";

/**
 * Receita imprimível.
 *
 * Desenhava o próprio cabeçalho (só nome da clínica e cidade, sem logo, sem
 * endereço, sem CNPJ) enquanto os documentos novos saíam timbrados — duas
 * identidades visuais na mesma clínica. Agora usa o mesmo `DocumentShell`, e
 * qualquer ajuste no timbre vale para todos os papéis de uma vez.
 */
export default async function ReceitaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await requireOrgAccess(slug);

  const p = await getPrescription(session.org, id);
  if (!p) notFound();

  const [letterhead, signature, customer] = await Promise.all([
    getLetterhead(session.org),
    getRecordedSignature(session.org, session.sub, {
      name: p.professional ?? "",
      council: p.professionalCouncil ?? "",
    }),
    prisma.customer.findFirst({
      where: { id: p.customerId, organizationId: session.org },
      select: { name: true, document: true },
    }),
  ]);

  return (
    <div>
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${p.customerId}`} />

      <DocumentShell
        letterhead={letterhead}
        title="Receituário"
        subtitle={customer?.name ?? undefined}
        signature={signature}
        issuedAt={new Date(p.issuedAt)}
      >
        <DocSection title="Paciente">
          <DocField label="Nome" value={customer?.name ?? "—"} />
          {customer?.document && (
            <DocField label="CPF" value={customer.document} />
          )}
          {p.cid && (
            <DocField
              label="CID"
              value={`${p.cid}${p.cidDescription ? ` — ${p.cidDescription}` : ""}`}
            />
          )}
        </DocSection>

        <DocSection title="Prescrição">
          <ol className="doc-request-list">
            {p.items.map((it, i) => (
              <li key={i} className="doc-qa-item">
                <p className="doc-strong">
                  {i + 1}. {it.medication}
                  {it.quantity ? `  —  ${it.quantity}` : ""}
                </p>
                {it.dosage && <p className="doc-qa-a">{it.dosage}</p>}
                {it.notes && <p className="doc-author">{it.notes}</p>}
              </li>
            ))}
          </ol>
        </DocSection>

        {p.instructions && (
          <DocSection title="Orientações">
            <p className="doc-paragraph doc-prewrap">{p.instructions}</p>
          </DocSection>
        )}
      </DocumentShell>
    </div>
  );
}
