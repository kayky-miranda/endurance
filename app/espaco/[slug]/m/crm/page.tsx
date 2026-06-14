import Link from "next/link";
import { Clock, TrendingUp, UserCheck, Users } from "lucide-react";
import { getCustomerInsights } from "@/lib/endurance/crm";
import { parsePage } from "@/lib/endurance/pagination";
import CrmCustomersTable from "../crm-client";
import CampaignsPanel from "../campaigns-panel";
import Pager from "../pager";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  RankList,
  brl,
} from "../module-kit";

// CRM: fidelidade e recompra de clientes (core — serve a todos os nichos).
export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "crm");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const ci = session
    ? await getCustomerInsights(session.org, parsePage(sp.pagina))
    : null;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!ci || ci.total === 0 ? (
        <EmptyCard>
          Nenhum cliente cadastrado ainda. Identifique clientes no{" "}
          <Link
            href={`/espaco/${slug}/m/pdv`}
            className="font-medium text-brand-500 hover:underline"
          >
            PDV
          </Link>{" "}
          durante a venda.
        </EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Users}
              label="Clientes"
              value={String(ci.total)}
              sub={`${ci.counts.ativo} ativos`}
              from="from-cyan-500"
              to="to-cyan-600"
            />
            <KpiCard
              icon={UserCheck}
              label="Ativos (30d)"
              value={String(ci.counts.ativo)}
              sub={`${ci.counts.em_risco} em risco`}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={Clock}
              label="Para recomprar"
              value={String(ci.dueCount)}
              sub="previsto pela IA"
              from="from-amber-500"
              to="to-amber-600"
            />
            <KpiCard
              icon={TrendingUp}
              label="Ticket médio/cliente"
              value={brl(ci.ticketMedio)}
              from="from-violet-500"
              to="to-violet-600"
            />
          </div>

          <CampaignsPanel />

          {ci.dueTop.length > 0 && (
            <RankList
              title="Clientes previstos para recompra"
              rows={ci.dueTop.slice(0, 5).map((c) => ({
                label: c.name,
                meta: c.lastDays !== null ? `${c.lastDays}d sem comprar` : "—",
                value: brl(c.totalSpent),
              }))}
            />
          )}

          <CrmCustomersTable rows={ci.customers} total={ci.total} />
          <Pager param="pagina" meta={ci.pageMeta} />
        </>
      )}
    </div>
  );
}
