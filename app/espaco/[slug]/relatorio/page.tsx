import { notFound } from "next/navigation";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { getSalesSummary } from "@/lib/endurance/sales-analytics";
import { getCashflow } from "@/lib/endurance/cashflow";
import ReportActions from "./report-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  // Relatório executivo exige a mesma permissão do módulo de relatórios.
  if (!sessionHasPermission(session, "finance.reports")) notFound();

  const ws = await getWorkspace(slug);
  const [summary, cashflow] = await Promise.all([
    getSalesSummary(session.org, 30),
    getCashflow(session.org, 30),
  ]);

  const emitido = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <ReportActions slug={slug} />

      <div className="report mx-auto max-w-[760px] rounded-xl border border-slate-200 bg-white p-10 text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {ws?.name ?? "Relatório"}
            </h1>
            <p className="text-sm text-slate-500">
              Relatório executivo · últimos {summary.days} dias
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Emitido em {emitido}</p>
            <p>por {session.name}</p>
          </div>
        </div>

        <Section title="Resumo de vendas">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <Stat label="Faturamento" value={brl(summary.faturamento)} />
            <Stat label="Vendas" value={String(summary.vendas)} />
            <Stat label="Ticket médio" value={brl(summary.ticketMedio)} />
            <Stat label="Itens vendidos" value={String(summary.itens)} />
            <Stat label="Faturamento hoje" value={brl(summary.hojeFaturamento)} />
            <Stat label="Vendas hoje" value={String(summary.hojeVendas)} />
          </div>
        </Section>

        <Section title="DRE simplificado (competência)">
          <table className="w-full text-sm">
            <tbody>
              <DreRow label="Receita de vendas" value={cashflow.dre.receita} />
              <DreRow label="(−) CMV" value={-cashflow.dre.cmv} />
              <DreRow label="= Lucro bruto" value={cashflow.dre.lucroBruto} bold />
              <DreRow
                label={`Margem bruta`}
                raw={`${cashflow.dre.margemBruta}%`}
              />
              <DreRow label="(−) Despesas" value={-cashflow.dre.despesas} />
              <DreRow label="= Resultado" value={cashflow.dre.resultado} bold />
            </tbody>
          </table>
        </Section>

        <Section title="Fluxo de caixa (realizado)">
          <div className="grid grid-cols-3 gap-x-8 text-sm">
            <Stat label="Entradas" value={brl(cashflow.totalEntradas)} />
            <Stat label="Saídas" value={brl(cashflow.totalSaidas)} />
            <Stat label="Saldo" value={brl(cashflow.saldo)} />
          </div>
        </Section>

        <Section title="Produtos mais vendidos">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5 font-medium">#</th>
                <th className="py-1.5 font-medium">Produto</th>
                <th className="py-1.5 text-right font-medium">Qtd</th>
                <th className="py-1.5 text-right font-medium">Receita</th>
              </tr>
            </thead>
            <tbody>
              {summary.topProdutos.map((p, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-400">{i + 1}</td>
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-right">{p.qty}</td>
                  <td className="py-1.5 text-right">{brl(p.revenue)}</td>
                </tr>
              ))}
              {summary.topProdutos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-400">
                    Sem vendas no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
          Gerado por ENDURANCE — relatório gerencial sem valor fiscal.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function DreRow({
  label,
  value,
  raw,
  bold,
}: {
  label: string;
  value?: number;
  raw?: string;
  bold?: boolean;
}) {
  const display =
    raw ??
    (value ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  return (
    <tr className={bold ? "border-t border-slate-200" : ""}>
      <td className={`py-1.5 ${bold ? "font-semibold" : "text-slate-500"}`}>
        {label}
      </td>
      <td
        className={`py-1.5 text-right tabular-nums ${bold ? "font-bold" : "text-slate-600"}`}
      >
        {display}
      </td>
    </tr>
  );
}
