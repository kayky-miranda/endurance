import { notFound } from "next/navigation";
import { vendorFooter } from "@/lib/endurance/white-label";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { getProductivityReport } from "@/lib/endurance/productivity";
import { getCommissionReport } from "@/lib/endurance/commissions";
import { parsePeriod, periodLabel } from "@/lib/endurance/period";
import ReportActions from "../report-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Relatório da clínica imprimível (PDF via window.print). Layout limpo do shell
 * (rota /relatorio/*). Reagrega no servidor pelo período; espelha a página do
 * módulo relatorios_clinica, formatado para papel/PDF.
 */
export default async function RelatorioClinicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await requireOrgAccess(slug);
  // Marca do fornecedor: some para quem tem marca própria (Enterprise).
  const marca = await vendorFooter(session.org, "Gerado por ENDURANCE");
  if (!sessionHasPermission(session, "finance.reports")) notFound();

  const days = parsePeriod(sp, 30);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const label = periodLabel(days);

  const [ws, productivity, commissions] = await Promise.all([
    getWorkspace(slug),
    getProductivityReport(session.org, from, to),
    getCommissionReport(session.org, from, to),
  ]);

  const totalFaltas = productivity.rows.reduce((s, r) => s + r.faltas, 0);
  const finalized = productivity.totalAtendidos + totalFaltas;
  const attendanceRate = finalized > 0 ? Math.round((productivity.totalAtendidos / finalized) * 100) : 0;
  const avgTicket =
    productivity.totalAtendidos > 0 ? productivity.totalRevenue / productivity.totalAtendidos : 0;

  const emitido = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <ReportActions slug={slug} backTo="relatorios_clinica" backLabel="Voltar aos relatórios" />

      <div className="report mx-auto max-w-[760px] rounded-xl border border-slate-200 bg-white p-10 text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{ws?.name ?? "Relatório da clínica"}</h1>
            <p className="text-sm text-slate-500">Relatório da clínica · {label}</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Emitido em {emitido}</p>
            <p>por {session.name}</p>
          </div>
        </div>

        <Section title="Indicadores do período">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="Atendimentos" value={String(productivity.totalAtendidos)} />
            <Stat label="Comparecimento" value={`${attendanceRate}%`} />
            <Stat label="Faturamento" value={brl(productivity.totalRevenue)} />
            <Stat label="Ticket médio" value={brl(avgTicket)} />
          </div>
        </Section>

        <Section title="Produtividade por profissional">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5 font-medium">Profissional</th>
                <th className="py-1.5 text-right font-medium">Atend.</th>
                <th className="py-1.5 text-right font-medium">Faltas</th>
                <th className="py-1.5 text-right font-medium">Compar.</th>
                <th className="py-1.5 text-right font-medium">Ticket</th>
                <th className="py-1.5 text-right font-medium">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {productivity.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5">{r.professional}</td>
                  <td className="py-1.5 text-right">{r.atendidos}</td>
                  <td className="py-1.5 text-right">{r.faltas}</td>
                  <td className="py-1.5 text-right">{Math.round(r.attendanceRate * 100)}%</td>
                  <td className="py-1.5 text-right">{brl(r.avgTicket)}</td>
                  <td className="py-1.5 text-right">{brl(r.revenue)}</td>
                </tr>
              ))}
              {productivity.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-400">
                    Sem atendimentos no período.
                  </td>
                </tr>
              )}
            </tbody>
            {productivity.rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right">{productivity.totalAtendidos}</td>
                  <td className="py-1.5 text-right">{totalFaltas}</td>
                  <td className="py-1.5 text-right">{attendanceRate}%</td>
                  <td />
                  <td className="py-1.5 text-right">{brl(productivity.totalRevenue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </Section>

        <Section title="Comissões por profissional">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5 font-medium">Profissional</th>
                <th className="py-1.5 font-medium">Registro</th>
                <th className="py-1.5 text-right font-medium">Atend.</th>
                <th className="py-1.5 text-right font-medium">Receita</th>
                <th className="py-1.5 text-right font-medium">%</th>
                <th className="py-1.5 text-right font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {commissions.rows.map((r) => (
                <tr key={r.userId} className="border-b border-slate-100">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5 text-slate-500">{r.council || "—"}</td>
                  <td className="py-1.5 text-right">{r.atendidos}</td>
                  <td className="py-1.5 text-right">{brl(r.revenue)}</td>
                  <td className="py-1.5 text-right">{r.commissionPercent}%</td>
                  <td className="py-1.5 text-right">{brl(r.commission)}</td>
                </tr>
              ))}
              {commissions.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-400">
                    Sem comissões no período.
                  </td>
                </tr>
              )}
            </tbody>
            {commissions.rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5">Total</td>
                  <td />
                  <td />
                  <td className="py-1.5 text-right">{brl(commissions.totalRevenue)}</td>
                  <td />
                  <td className="py-1.5 text-right">{brl(commissions.totalCommission)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </Section>

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
          {[marca, "relatório gerencial sem valor fiscal."].filter(Boolean).join(" — ")}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
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
