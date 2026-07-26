import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getCertificate,
  certificateKindLabel,
} from "@/lib/endurance/certificates";
import PrintActions from "../../receita/[id]/print-actions";

/** Atestado imprimível (layout limpo, fora do shell). */
export default async function AtestadoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const session = await requireOrgAccess(slug);

  const c = await getCertificate(session.org, id);
  if (!c) notFound();

  const [org, customer] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.org },
      select: { name: true, city: true, state: true },
    }),
    prisma.customer.findFirst({
      where: { id: c.customerId, organizationId: session.org },
      select: { name: true, document: true },
    }),
  ]);

  const issued = new Date(c.issuedAt);
  const longDate = (s: string) =>
    new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  // Texto padrão quando o profissional não escreveu um corpo.
  const body =
    c.text ||
    defaultBody(c.kind, customer?.name ?? "o(a) paciente", c.days, c.startDate);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6 text-slate-900">
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${c.customerId}`} />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 print:border-0 print:p-0">
        <header className="border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-bold">{org?.name ?? "Clínica"}</h1>
          {(org?.city || org?.state) && (
            <p className="text-xs text-slate-500">
              {[org?.city, org?.state].filter(Boolean).join(" / ")}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Atestado {certificateKindLabel(c.kind)}
          </p>
        </header>

        <div className="mt-6 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{body}</p>
          {c.cid && (
            <p className="mt-4 text-slate-600">
              CID: {c.cid}
              {c.cidDescription ? ` — ${c.cidDescription}` : ""}
            </p>
          )}
          {customer?.document && (
            <p className="mt-1 text-slate-500">CPF: {customer.document}</p>
          )}
        </div>

        <div className="mt-12 text-center text-sm">
          <div className="mx-auto w-64 border-t border-slate-400 pt-1">
            <p className="font-semibold">{c.professional || "Profissional responsável"}</p>
            {c.professionalCouncil && (
              <p className="text-xs text-slate-500">{c.professionalCouncil}</p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-400">Emitido em {longDate(issued.toISOString())}</p>
        </div>
      </div>
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
