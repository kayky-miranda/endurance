import { notFound } from "next/navigation";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { getFinanceOverview } from "@/lib/endurance/finance";
import { getCashflow } from "@/lib/endurance/cashflow";
import ReportActions from "../report-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function RelatorioFinanceiroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireOrgAccess(slug);
  if (!sessionHasPermission(session, "finance.reports")) notFound();

  const ws = await getWorkspace(slug);
  const [fin, cashflow] = await Promise.all([
    getFinanceOverview(session.org),
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
      <ReportActions slug={slug} backTo="financeiro" backLabel="Voltar ao financeiro" />

      <div className="report mx-auto max-w-[760px] rounded-xl border border-slate-200 bg-white p-10 text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {ws?.name ?? "Relatório"}
            </h1>
            <p className="text-sm text-slate-500">Relatório financeiro</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Emitido em {emitido}</p>
            <p>por {session.name}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="A receber" value={brl(fin.kpis.aReceber)} />
          <Stat label="A pagar" value={brl(fin.kpis.aPagar)} />
          <Stat label="Saldo previsto" value={brl(fin.kpis.saldoPrevisto)} />
          <Stat label="Vencidos" value={String(fin.kpis.vencidos)} />
        </div>

        <Section title="DRE simplificado (competência)">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Receita de vendas" value={cashflow.dre.receita} />
              <Row label="(−) CMV" value={-cashflow.dre.cmv} />
              <Row label="= Lucro bruto" value={cashflow.dre.lucroBruto} bold />
              <Row label="(−) Despesas" value={-cashflow.dre.despesas} />
              <Row label="= Resultado" value={cashflow.dre.resultado} bold />
            </tbody>
          </table>
        </Section>

        <Section title="Contas a receber">
          <EntryTable rows={fin.receber} />
        </Section>

        <Section title="Contas a pagar">
          <EntryTable rows={fin.pagar} />
        </Section>

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
          Gerado por ENDURANCE — relatório financeiro gerencial sem valor fiscal.
        </p>
      </div>
    </div>
  );
}

function EntryTable({
  rows,
}: {
  rows: {
    description: string;
    category: string;
    amount: number;
    status: string;
    dueDate: string;
  }[];
}) {
  if (rows.length === 0)
    return <p className="py-2 text-sm text-slate-400">Sem lançamentos.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
          <th className="py-1.5 font-medium">Descrição</th>
          <th className="py-1.5 font-medium">Categoria</th>
          <th className="py-1.5 font-medium">Vencimento</th>
          <th className="py-1.5 font-medium">Status</th>
          <th className="py-1.5 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100">
            <td className="py-1.5">{r.description}</td>
            <td className="py-1.5 text-slate-500">{r.category}</td>
            <td className="py-1.5 text-slate-500">{r.dueDate}</td>
            <td className="py-1.5 text-slate-500">
              {r.status === "pago" ? "Pago" : "Pendente"}
            </td>
            <td className="py-1.5 text-right tabular-nums">{brl(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "border-t border-slate-200" : ""}>
      <td className={`py-1.5 ${bold ? "font-semibold" : "text-slate-500"}`}>
        {label}
      </td>
      <td
        className={`py-1.5 text-right tabular-nums ${bold ? "font-bold" : "text-slate-600"}`}
      >
        {brl(value)}
      </td>
    </tr>
  );
}
