"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import type { ProductivityReport } from "@/lib/endurance/productivity";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ProductivityPanel({
  report,
  periodLabel,
  defaultOpen = false,
}: {
  report: ProductivityReport;
  periodLabel: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (report.rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Activity className="h-4 w-4 text-brand-500" /> Produtividade por profissional
          <span className="text-xs font-normal text-slate-400">· {periodLabel}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {report.totalAtendidos} atend.
          </span>
          {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-slate-100 px-5 py-4 dark:border-ink-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-ink-800">
                <th className="py-2 pr-3 font-medium">Profissional</th>
                <th className="py-2 pr-3 text-right font-medium">Atend.</th>
                <th className="py-2 pr-3 text-right font-medium">Faltas</th>
                <th className="py-2 pr-3 text-right font-medium">Compar.</th>
                <th className="py-2 pr-3 text-right font-medium">Ticket méd.</th>
                <th className="py-2 text-right font-medium">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
              {report.rows.map((r) => (
                <tr key={r.professional}>
                  <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{r.professional}</td>
                  <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{r.atendidos}</td>
                  <td className="py-2 pr-3 text-right text-slate-500">{r.faltas}</td>
                  <td className="py-2 pr-3 text-right">
                    <span className={r.attendanceRate < 0.7 && r.atendidos + r.faltas > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}>
                      {Math.round(r.attendanceRate * 100)}%
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{brl(r.avgTicket)}</td>
                  <td className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{brl(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 text-sm font-semibold dark:border-ink-700">
                <td className="py-2 pr-3 text-slate-500">Total</td>
                <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{report.totalAtendidos}</td>
                <td /><td /><td />
                <td className="py-2 text-right text-slate-800 dark:text-slate-100">{brl(report.totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
