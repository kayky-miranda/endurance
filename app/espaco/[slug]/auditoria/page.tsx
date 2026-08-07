import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { requireOrgAccess, canManageTeamSession } from "@/lib/auth";
import { checkPlanFeature } from "@/lib/endurance/plan-limits";
import { listAuditLog, AUDIT_PAGE_SIZE } from "@/lib/endurance/audit";
import { PlanLocked } from "../m/module-kit";
import Pager from "../m/pager";
import AuditFilters from "./filters";

/**
 * Trilha de auditoria — a superfície de LEITURA do registro que o sistema já
 * gravava em ~130 pontos.
 *
 * Duas guardas, e a ordem importa:
 *  1. PERFIL (`canManageTeamSession`): a trilha atravessa prontuário, caixa e
 *     fiscal. Quem não administra o espaço não pode ver por aqui o que não veria
 *     no módulo de origem — a auditoria não pode virar uma porta lateral para
 *     dado clínico;
 *  2. PLANO (`audit.log`): quem tem o perfil mas não o plano vê a oferta de
 *     upgrade, não um 404.
 */
export const dynamic = "force-dynamic";

export default async function AuditoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    dominio?: string;
    autor?: string;
    dias?: string;
    pagina?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await requireOrgAccess(slug);
  if (!canManageTeamSession(session)) redirect(`/espaco/${slug}`);

  const gate = await checkPlanFeature(session.org, "audit.log");
  if (!gate.ok)
    return (
      <div className="space-y-6">
        <BackLink slug={slug} />
        <PlanLocked
          slug={slug}
          feature="audit.log"
          requiredPlan={gate.requiredPlan}
        />
      </div>
    );

  const page = Math.max(1, Number(sp.pagina) || 1);
  const days = Number(sp.dias) || 90;
  const data = await listAuditLog(session.org, {
    q: sp.q,
    domain: sp.dominio,
    actorId: sp.autor,
    days,
    page,
  });

  const pageCount = Math.max(1, Math.ceil(data.total / AUDIT_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <BackLink slug={slug} />
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-brand-500" />
          Auditoria
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Quem alterou o quê, e quando. O registro é gravado em todos os planos —
          inclusive antes de você contratar este.
        </p>
      </div>

      <AuditFilters actors={data.actors} />

      {data.entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-ink-700 dark:text-slate-400">
          Nenhum registro no período com esses filtros.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-ink-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Quando</th>
                  <th className="px-4 py-2.5 font-semibold">Quem</th>
                  <th className="px-4 py-2.5 font-semibold">Área</th>
                  <th className="px-4 py-2.5 font-semibold">O que aconteceu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                {data.entries.map((e) => (
                  <tr
                    key={e.id}
                    className="bg-white dark:bg-ink-900 [&:hover]:bg-slate-50 dark:[&:hover]:bg-ink-800/60"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {formatWhen(e.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                      {e.actorName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                          e.sensitive
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300"
                        }`}
                        title={
                          e.sensitive
                            ? "Envolve dado pessoal ou clínico"
                            : undefined
                        }
                      >
                        {e.sensitive && <Lock className="h-2.5 w-2.5" />}
                        {e.domainLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      {e.detail || e.action}
                      <span className="ml-2 font-mono text-[10px] text-slate-400">
                        {e.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager
        param="pagina"
        meta={{ page: data.page, pageCount, total: data.total }}
      />
    </div>
  );
}

function BackLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/espaco/${slug}`}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
    >
      <ArrowLeft className="h-4 w-4" />
      Visão geral
    </Link>
  );
}

const WHEN = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string): string {
  return WHEN.format(new Date(iso));
}
