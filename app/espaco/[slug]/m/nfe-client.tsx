"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  AlertCircle,
  Settings,
} from "lucide-react";
import { emitNfeAction, cancelNfeAction } from "./nfe-actions";

type NfeRow = {
  saleId: string;
  docId: string | null;
  numero: number | null;
  status: "autorizada" | "cancelada" | "pendente" | "bloqueada";
  chave: string | null;
  total: number;
  cliente: string;
  documento: string;
  quando: string;
  motivo?: string;
};
type Config = { configured: boolean; cnpj: string; razaoSocial: string };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function NfeClient({
  slug,
  rows,
  config,
  canManage,
}: {
  slug: string;
  rows: NfeRow[];
  config: Config;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function emit(saleId: string) {
    setBusyId(saleId);
    setError("");
    try {
      const res = await emitNfeAction(saleId);
      if (res.ok) router.refresh();
      else setError(res.error || "Falha ao emitir.");
    } finally {
      setBusyId("");
    }
  }

  async function cancel(docId: string) {
    const motivo = window.prompt(
      "Justificativa do cancelamento (mínimo 15 caracteres):",
    );
    if (motivo == null) return;
    if (motivo.trim().length < 15) {
      setError("A justificativa precisa ter ao menos 15 caracteres.");
      return;
    }
    setBusyId(docId);
    setError("");
    try {
      const res = await cancelNfeAction(docId, motivo.trim());
      if (res.ok) router.refresh();
      else setError(res.error || "Falha ao cancelar.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      {!config.configured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-500/5 px-4 py-3 dark:border-amber-500/30">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Complete os dados fiscais (CNPJ e razão social) para emitir.
          </div>
          <Link
            href={`/espaco/${slug}/m/nfce`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-300"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Vendas elegíveis a NF-e
          </h2>
          <span className="text-xs text-slate-400">
            clientes identificados (CPF/CNPJ)
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-400">
            Nenhuma venda com cliente identificado ainda. Identifique o cliente
            (com CPF/CNPJ) ao registrar a venda no PDV.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Documento</th>
                  <th className="px-5 py-2.5 font-medium">Data</th>
                  <th className="px-5 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.saleId}
                    className="border-b border-slate-50 last:border-0 dark:border-ink-800"
                  >
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                      {r.cliente}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{r.documento}</td>
                    <td className="px-5 py-3 text-slate-500">{r.quando}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                      {brl(r.total)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} motivo={r.motivo} numero={r.numero} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "pendente" && canManage && (
                          <button
                            onClick={() => emit(r.saleId)}
                            disabled={busyId === r.saleId || !config.configured}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
                          >
                            {busyId === r.saleId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            Emitir NF-e
                          </button>
                        )}
                        {r.docId && (
                          <Link
                            href={`/espaco/${slug}/nfce/${r.docId}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            DANFE
                          </Link>
                        )}
                        {r.status === "autorizada" && r.docId && canManage && (
                          <button
                            onClick={() => cancel(r.docId!)}
                            disabled={busyId === r.docId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:border-red-400 disabled:opacity-40 dark:border-ink-600"
                          >
                            {busyId === r.docId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  motivo,
  numero,
}: {
  status: NfeRow["status"];
  motivo?: string;
  numero: number | null;
}) {
  if (status === "autorizada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Autorizada{numero ? ` · nº ${numero}` : ""}
      </span>
    );
  if (status === "cancelada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-500 dark:text-red-300">
        <XCircle className="h-3.5 w-3.5" />
        Cancelada
      </span>
    );
  if (status === "bloqueada")
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-ink-800 dark:text-slate-400"
        title={motivo}
      >
        <Ban className="h-3.5 w-3.5" />
        {motivo ?? "Indisponível"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      Pendente
    </span>
  );
}
