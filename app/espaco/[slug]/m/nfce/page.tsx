import { CheckCircle2, Clock, DollarSign, FileText } from "lucide-react";
import { getNfceOverview } from "@/lib/endurance/fiscal-service";
import {
  getImportedInvoices,
  type ImportedInvoiceRow,
} from "@/lib/endurance/invoice-import";
import { parsePage } from "@/lib/endurance/pagination";
import FiscalClient from "../fiscal-client";
import Pager from "../pager";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  EmptyCard,
  KpiCard,
  brl,
} from "../module-kit";

// Fiscal — emissão de NFC-e (modelo 65) a partir das vendas do PDV.
export default async function NfcePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "nfce");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  const data = session
    ? await getNfceOverview(session.org, parsePage(sp.pagina))
    : null;
  const imported = session ? await getImportedInvoices(session.org) : [];

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
              label="Vendas sem NFC-e"
              value={String(data.kpis.pendentes)}
              from="from-amber-500"
              to="to-amber-600"
            />
          </div>

          <FiscalClient slug={slug} rows={data.rows} config={data.config} />
          <Pager param="pagina" meta={data.pageMeta} />
          <ImportedInvoicesList rows={imported} />
        </>
      )}
    </div>
  );
}

function ImportedInvoicesList({ rows }: { rows: ImportedInvoiceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Notas fiscais importadas
        <span className="ml-2 font-normal text-slate-400">
          via XML · {rows.length}
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Modelo</th>
              <th className="px-5 py-2.5 font-medium">Número</th>
              <th className="px-5 py-2.5 font-medium">Emitente</th>
              <th className="px-5 py-2.5 font-medium">Emissão</th>
              <th className="px-5 py-2.5 font-medium">Itens</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
              <th className="px-5 py-2.5 font-medium">Lançamentos</th>
              <th className="px-5 py-2.5 font-medium">Chave</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 last:border-0 dark:border-ink-800"
              >
                <td className="px-5 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                    {r.modelo === "65" ? "NFC-e" : "NF-e"} {r.modelo}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {r.numero}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {r.emitNome}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.dhEmi}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.itemsCount}
                </td>
                <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                  {brl(r.total)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.appliedStock && (
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        estoque
                      </span>
                    )}
                    {r.appliedPayable && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        a pagar
                      </span>
                    )}
                    {!r.appliedStock && !r.appliedPayable && (
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">
                        —
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-[10px] text-slate-400">
                  …{r.chave.slice(-16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
