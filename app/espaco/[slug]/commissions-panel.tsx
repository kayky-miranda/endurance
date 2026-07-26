"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Percent,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import type { CommissionReport } from "@/lib/endurance/commissions";
import {
  setCommissionPercentAction,
  setProfessionalCouncilAction,
} from "./commissions-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CommissionsPanel({
  report,
  canConfig,
  periodLabel,
}: {
  report: CommissionReport;
  canConfig: boolean;
  periodLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [editingCouncil, setEditingCouncil] = useState<string | null>(null);
  const [councilValue, setCouncilValue] = useState("");
  const [error, setError] = useState("");

  function save(userId: string) {
    setError("");
    startTransition(async () => {
      const res = await setCommissionPercentAction(userId, Number(value.replace(",", ".")) || 0);
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  function saveCouncil(userId: string) {
    setError("");
    startTransition(async () => {
      const res = await setProfessionalCouncilAction(userId, councilValue);
      if (res.ok) {
        setEditingCouncil(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Percent className="h-4 w-4 text-brand-500" /> Comissões de profissionais
          <span className="text-xs font-normal text-slate-400">· {periodLabel}</span>
        </span>
        <span className="flex items-center gap-3">
          {report.totalCommission > 0 && (
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {brl(report.totalCommission)}
            </span>
          )}
          {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-ink-800">
          {error && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-ink-800">
                  <th className="py-2 pr-3 font-medium">Profissional</th>
                  <th className="py-2 pr-3 font-medium">Registro</th>
                  <th className="py-2 pr-3 text-right font-medium">Atend.</th>
                  <th className="py-2 pr-3 text-right font-medium">Receita</th>
                  <th className="py-2 pr-3 text-right font-medium">%</th>
                  <th className="py-2 text-right font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-ink-800">
                {report.rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{r.name}</td>
                    <td className="py-2 pr-3">
                      {canConfig && editingCouncil === r.userId ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            value={councilValue}
                            onChange={(e) => setCouncilValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveCouncil(r.userId)}
                            placeholder="CRM-SP 123456"
                            className="w-28 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                          />
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          ) : (
                            <button onClick={() => saveCouncil(r.userId)} aria-label="Salvar registro" className="text-emerald-500 hover:text-emerald-600">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      ) : canConfig ? (
                        <button
                          onClick={() => {
                            setError("");
                            setEditingCouncil(r.userId);
                            setCouncilValue(r.council);
                          }}
                          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-brand-500 dark:hover:bg-ink-800"
                        >
                          {r.council || <span className="text-slate-300 dark:text-slate-600">definir</span>}
                        </button>
                      ) : (
                        <span className="text-slate-500">{r.council || "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-500">{r.atendidos}</td>
                    <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{brl(r.revenue)}</td>
                    <td className="py-2 pr-3 text-right">
                      {canConfig && editing === r.userId ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && save(r.userId)}
                            className="w-14 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right text-xs dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                          />
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          ) : (
                            <button onClick={() => save(r.userId)} aria-label="Salvar" className="text-emerald-500 hover:text-emerald-600">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      ) : canConfig ? (
                        <button
                          onClick={() => {
                            setError("");
                            setEditing(r.userId);
                            setValue(String(r.commissionPercent));
                          }}
                          className="rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-brand-500 dark:text-slate-300 dark:hover:bg-ink-800"
                        >
                          {r.commissionPercent}%
                        </button>
                      ) : (
                        <span className="text-slate-500">{r.commissionPercent}%</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{brl(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 text-sm font-semibold dark:border-ink-700">
                  <td className="py-2 pr-3 text-slate-500">Total</td>
                  <td />
                  <td />
                  <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-300">{brl(report.totalRevenue)}</td>
                  <td />
                  <td className="py-2 text-right text-slate-800 dark:text-slate-100">{brl(report.totalCommission)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {canConfig && (
            <p className="mt-2 text-[11px] text-slate-400">
              Clique no % para ajustar a comissão de cada profissional.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
