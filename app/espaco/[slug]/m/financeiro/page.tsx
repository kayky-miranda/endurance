import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
} from "lucide-react";
import { getFinanceOverview } from "@/lib/endurance/finance";
import { getReconciliationOverview } from "@/lib/endurance/reconciliation";
import { parsePage } from "@/lib/endurance/pagination";
import FinanceClient from "../finance-client";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Financeiro — contas a receber/pagar (recebíveis vêm das vendas do PDV).
export default async function FinanceiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rec?: string; pag?: string; con?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "financeiro");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const [fin, conciliacao] = session
    ? await Promise.all([
        getFinanceOverview(session.org, {
          receber: parsePage(sp.rec),
          pagar: parsePage(sp.pag),
        }),
        getReconciliationOverview(session.org, parsePage(sp.con)),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      {!fin ? (
        <EmptyCard>Sessão expirada.</EmptyCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={ArrowDownLeft}
              label="A receber"
              value={brl(fin.kpis.aReceber)}
              sub={`${brl(fin.kpis.recebidoMes)} recebido no mês`}
              from="from-emerald-500"
              to="to-emerald-600"
            />
            <KpiCard
              icon={ArrowUpRight}
              label="A pagar"
              value={brl(fin.kpis.aPagar)}
              sub={`${brl(fin.kpis.pagoMes)} pago no mês`}
              from="from-rose-500"
              to="to-rose-600"
            />
            <KpiCard
              icon={Banknote}
              label="Saldo previsto"
              value={brl(fin.kpis.saldoPrevisto)}
              from="from-brand-500"
              to="to-brand-600"
            />
            <KpiCard
              icon={AlertCircle}
              label="Vencidos"
              value={String(fin.kpis.vencidos)}
              from="from-amber-500"
              to="to-amber-600"
            />
          </div>

          <FinanceClient
            slug={slug}
            receber={fin.receber}
            pagar={fin.pagar}
            receberMeta={fin.receberMeta}
            pagarMeta={fin.pagarMeta}
            conciliacao={conciliacao}
          />
        </>
      )}
    </div>
  );
}
