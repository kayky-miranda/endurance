import { CheckCircle2, Clock, DollarSign, FileText } from "lucide-react";
import { sessionHasPermission } from "@/lib/auth";
import { getNfeOverview } from "@/lib/endurance/nfe-service";
import { parsePage } from "@/lib/endurance/pagination";
import NfeClient from "../nfe-client";
import Pager from "../pager";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// NF-e (modelo 55) — emissão a partir de vendas com cliente identificado.
export default async function NfePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "nfe");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getNfeOverview(session.org, parsePage(sp.pagina))
    : null;
  const canManage = session
    ? sessionHasPermission(session, "fiscal.manage")
    : false;

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!data ? (
        <EmptyCard>Sessão expirada.</EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={FileText}
              label="Emitidas hoje"
              value={String(data.kpis.emitidasHoje)}
              from="from-brand-500"
              to="to-brand-600"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Autorizadas no mês"
              value={String(data.kpis.autorizadasMes)}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={DollarSign}
              label="Faturado no mês"
              value={brl(data.kpis.valorMes)}
              from="from-cyan-500"
              to="to-cyan-600"
            />
            <KpiCard
              icon={Clock}
              label="Vendas elegíveis sem NF-e"
              value={String(data.kpis.pendentes)}
              from="from-amber-500"
              to="to-amber-600"
            />
          </div>
          <NfeClient
            slug={slug}
            rows={data.rows}
            config={data.config}
            canManage={canManage}
          />
          <Pager param="pagina" meta={data.pageMeta} />
        </>
      )}
    </div>
  );
}
