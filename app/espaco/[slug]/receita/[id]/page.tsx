import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrescription } from "@/lib/endurance/prescriptions";
import PrintActions from "./print-actions";

/**
 * Receita imprimível (layout limpo, fora do shell). Cabeçalho com dados da
 * clínica, paciente, itens (medicamento/posologia/quantidade), CID, orientações
 * e assinatura do profissional.
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

  const [org, customer] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.org },
      select: { name: true, city: true, state: true },
    }),
    prisma.customer.findFirst({
      where: { id: p.customerId, organizationId: session.org },
      select: { name: true, document: true },
    }),
  ]);

  const issued = new Date(p.issuedAt);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-6 text-slate-900">
      <PrintActions backHref={`/espaco/${slug}/m/prontuario/${p.customerId}`} />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 print:border-0 print:p-0">
        {/* Cabeçalho */}
        <header className="border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-bold">{org?.name ?? "Clínica"}</h1>
          {(org?.city || org?.state) && (
            <p className="text-xs text-slate-500">
              {[org?.city, org?.state].filter(Boolean).join(" / ")}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Receituário
          </p>
        </header>

        {/* Paciente */}
        <div className="mt-4 text-sm">
          <p>
            <span className="text-slate-500">Paciente:</span>{" "}
            <strong>{customer?.name ?? "—"}</strong>
          </p>
          {customer?.document && (
            <p>
              <span className="text-slate-500">CPF:</span> {customer.document}
            </p>
          )}
          {p.cid && (
            <p>
              <span className="text-slate-500">CID:</span> {p.cid}
              {p.cidDescription ? ` — ${p.cidDescription}` : ""}
            </p>
          )}
        </div>

        {/* Itens */}
        <ol className="mt-5 space-y-3">
          {p.items.map((it, i) => (
            <li key={i} className="border-b border-dashed border-slate-200 pb-3">
              <p className="font-semibold">
                {i + 1}. {it.medication}
                {it.quantity ? `  —  ${it.quantity}` : ""}
              </p>
              {it.dosage && <p className="text-sm text-slate-600">{it.dosage}</p>}
              {it.notes && <p className="text-xs text-slate-500">{it.notes}</p>}
            </li>
          ))}
        </ol>

        {p.instructions && (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-slate-700">Orientações</p>
            <p className="whitespace-pre-wrap text-slate-600">{p.instructions}</p>
          </div>
        )}

        {/* Assinatura */}
        <div className="mt-12 text-center text-sm">
          <div className="mx-auto w-64 border-t border-slate-400 pt-1">
            <p className="font-semibold">{p.professional || "Profissional responsável"}</p>
            {p.professionalCouncil && (
              <p className="text-xs text-slate-500">{p.professionalCouncil}</p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Emitida em{" "}
            {issued.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
