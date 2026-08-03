import { notFound } from "next/navigation";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { canAccessModule } from "@/lib/endurance/permissions";
import {
  documentById,
  parseDocSelection,
  type DocumentType,
} from "@/lib/endurance/document-catalog";
import { buildDocument } from "@/lib/endurance/document-data";
import {
  getLetterhead,
  getSignature,
} from "@/lib/endurance/document-letterhead";
import { DocumentShell, PageBreak } from "../../../components/DocumentShell";
import { renderDocument } from "../../renderers";
import PrintActions from "../../print-actions";

/**
 * Rota única de documentos imprimíveis: `/documento/[tipo]/[customerId]`.
 *
 * `tipo = lote` imprime VÁRIOS documentos do mesmo paciente numa só passada
 * (`?docs=anamnese,prontuario,…`), separados por quebra de página. É assim que
 * se obtém "um único PDF" sem embutir um motor de PDF no servidor: o navegador
 * gera um documento só a partir de uma página só.
 *
 * O shell do app já renderiza `/documento/*` sem sidebar (branch de impressão).
 */

export const dynamic = "force-dynamic";

export default async function DocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; tipo: string; customerId: string }>;
  searchParams: Promise<{ docs?: string }>;
}) {
  const { slug, tipo, customerId } = await params;
  const sp = await searchParams;
  const session = await requireOrgAccess(slug);

  const batch = tipo === "lote";
  const types: DocumentType[] = batch
    ? parseDocSelection(sp.docs)
    : (() => {
        const def = documentById(tipo);
        return def ? [def.id] : [];
      })();
  if (types.length === 0) notFound();

  // Cada documento é liberado pela permissão do módulo a que pertence — a
  // ficha cadastral não deve sair para quem não pode ver pacientes, nem o
  // prontuário para quem não tem acesso clínico.
  const allowed = types.filter((t) => {
    const def = documentById(t);
    return def
      ? canAccessModule(session.role, session.permissions, def.module)
      : false;
  });
  if (allowed.length === 0) notFound();

  const [letterhead, signature, ...payloads] = await Promise.all([
    getLetterhead(session.org),
    getSignature(session.org, session.sub, session.name),
    ...allowed.map((t) => buildDocument(session.org, t, customerId)),
  ]);

  const docs = allowed
    .map((t, i) => ({ def: documentById(t)!, payload: payloads[i] }))
    .filter((d) => d.payload !== null);
  if (docs.length === 0) notFound();

  const backHref = `/espaco/${slug}/m/prontuario/${customerId}`;
  // Nome do paciente para o subtítulo: qualquer payload serve.
  const first = docs[0].payload!;
  const patientName =
    first.type === "ficha-cadastral" ? first.detail.name : first.patient.name;

  return (
    <div>
      <PrintActions backHref={backHref} />
      {docs.map((d, i) => (
        <div key={d.def.id}>
          <DocumentShell
            letterhead={letterhead}
            title={d.def.title}
            subtitle={patientName}
            signature={d.def.signed ? signature : null}
          >
            {renderDocument(d.payload!)}
          </DocumentShell>
          {i < docs.length - 1 && <PageBreak />}
        </div>
      ))}
    </div>
  );
}
