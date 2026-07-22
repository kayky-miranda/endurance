"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Inbox,
  ChevronDown,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { PendingApprovalRow } from "@/lib/endurance/approvals";
import type { ApprovalDecision } from "@/lib/endurance/approvals";
import { approvalLevelLabel } from "@/lib/endurance/approval-rules";
import { decideApprovalAction } from "./approvals-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export default function ApprovalsClient({
  rows,
  meta,
}: {
  rows: PendingApprovalRow[];
  meta: PageMeta;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  async function decide(row: PendingApprovalRow, decision: ApprovalDecision) {
    // Rejeição e ajuste pedem motivo; aprovação é direta.
    if (decision !== "aprovar" && noteFor !== row.approvalId) {
      setNoteFor(row.approvalId);
      setNote("");
      return;
    }
    setBusy(row.approvalId);
    const res = await decideApprovalAction(
      row.approvalId,
      row.requisitionId,
      decision,
      note,
    );
    setBusy("");
    setNoteFor(null);
    setNote("");
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          Nenhuma aprovação pendente
        </p>
        <p className="mt-1 text-xs text-slate-500">
          As solicitações enviadas para aprovação aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const open = openId === r.approvalId;
        const asking = noteFor === r.approvalId;
        const loading = busy === r.approvalId;
        return (
          <div
            key={r.approvalId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {r.number}
                  </span>
                  <LevelBadge level={r.level} />
                  <PriorityBadge priority={r.priority} />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {r.requester || "—"}
                  {r.costCenter ? ` · ${r.costCenter}` : ""} · {r.createdAt}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {brl(r.estimatedTotal)}
                </p>
                <button
                  onClick={() => setOpenId(open ? null : r.approvalId)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-500"
                >
                  {r.itemsCount} {r.itemsCount === 1 ? "item" : "itens"}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>

            {open && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 dark:border-ink-800">
                <table className="w-full text-sm">
                  <tbody>
                    {r.items.map((it, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                      >
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {it.name}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {it.quantity} × {brl(it.estimatedUnitCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {asking && (
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo / observação (obrigatório)"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
               aria-label="Motivo / observação (obrigatório)" />
            )}

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => decide(r, "ajuste")}
                disabled={loading || (asking && !note.trim())}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-amber-600 transition hover:border-amber-500/60 disabled:opacity-40 dark:border-ink-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Solicitar ajuste
              </button>
              <button
                onClick={() => decide(r, "rejeitar")}
                disabled={loading || (asking && !note.trim())}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-red-500 transition hover:border-red-500/60 disabled:opacity-40 dark:border-ink-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                Rejeitar
              </button>
              <button
                onClick={() => decide(r, "aprovar")}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Aprovar
              </button>
            </div>
          </div>
        );
      })}
      <Pager param="pagina" meta={meta} />
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">
      {approvalLevelLabel(level)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    baixa: "bg-slate-400/15 text-slate-500",
    media: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    alta: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    urgente: "bg-red-500/15 text-red-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[priority] ?? map.media}`}>
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}
