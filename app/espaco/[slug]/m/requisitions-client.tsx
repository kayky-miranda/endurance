"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  ClipboardList,
  Send,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type {
  RequisitionRow,
  RequisitionDetail,
} from "@/lib/endurance/requisitions";
import { reqStatusLabel } from "@/lib/endurance/requisition-status";
import { approvalLevelLabel } from "@/lib/endurance/approval-rules";
import {
  createRequisitionAction,
  updateRequisitionAction,
  submitRequisitionAction,
  deleteRequisitionAction,
  loadRequisitionAction,
  createCostCenterAction,
} from "./requisitions-actions";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Product = { id: string; name: string; cost: number };
type CostCenter = { id: string; name: string; code: string; active: boolean };
type ItemDraft = {
  productId: string;
  name: string;
  quantity: string;
  estimatedUnitCost: string;
  priority: string;
  justification: string;
};

const PRIORITY_OPTS = [
  { id: "baixa", label: "Baixa" },
  { id: "media", label: "Média" },
  { id: "alta", label: "Alta" },
  { id: "urgente", label: "Urgente" },
];

const emptyItem = (): ItemDraft => ({
  productId: "",
  name: "",
  quantity: "1",
  estimatedUnitCost: "0",
  priority: "media",
  justification: "",
});

export default function RequisitionsClient({
  slug,
  rows,
  meta,
  status,
  products,
  costCenters,
  canManage,
}: {
  slug: string;
  rows: RequisitionRow[];
  meta: PageMeta;
  status: string;
  products: Product[];
  costCenters: CostCenter[];
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [drawer, setDrawer] = useState<null | "form" | "view">(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RequisitionDetail | null>(null);
  const [costCenterId, setCostCenterId] = useState("");
  const [priority, setPriority] = useState("media");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  function setStatusFilter(s: string) {
    const params = new URLSearchParams(search.toString());
    if (s) params.set("status", s);
    else params.delete("status");
    params.delete("pagina");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function openCreate() {
    setEditId(null);
    setDetail(null);
    setCostCenterId("");
    setPriority("media");
    setNote("");
    setItems([emptyItem()]);
    setError("");
    setDrawer("form");
  }

  async function openView(id: string) {
    setDrawer("view");
    setDetail(null);
    setError("");
    const res = await loadRequisitionAction(id);
    if (res.ok && res.detail) setDetail(res.detail);
    else setError(res.error ?? "Erro ao carregar.");
  }

  function openEdit(d: RequisitionDetail) {
    setEditId(d.id);
    setCostCenterId(d.costCenterId ?? "");
    setPriority(d.priority);
    setNote(d.note);
    setItems(
      d.items.map((it) => ({
        productId: it.productId ?? "",
        name: it.name,
        quantity: String(it.quantity),
        estimatedUnitCost: String(it.estimatedUnitCost),
        priority: it.priority,
        justification: it.justification,
      })),
    );
    setError("");
    setDrawer("form");
  }

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function onPickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    updateItem(i, {
      productId,
      ...(p ? { name: p.name, estimatedUnitCost: String(p.cost) } : {}),
    });
  }

  const estimatedTotal = items.reduce(
    (a, it) =>
      a +
      (parseFloat(it.quantity.replace(",", ".")) || 0) *
        (parseFloat(it.estimatedUnitCost.replace(",", ".")) || 0),
    0,
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const payload = {
      costCenterId: costCenterId || null,
      priority,
      note,
      items: items.map((it) => ({
        productId: it.productId || null,
        name: it.name,
        quantity: parseInt(it.quantity, 10) || 0,
        estimatedUnitCost: parseFloat(it.estimatedUnitCost.replace(",", ".")) || 0,
        priority: it.priority,
        justification: it.justification,
      })),
    };
    const res = editId
      ? await updateRequisitionAction(editId, payload)
      : await createRequisitionAction(payload);
    setBusy(false);
    if (res.ok) {
      setDrawer(null);
      router.refresh();
    } else {
      setError(res.error ?? "Erro ao salvar.");
    }
  }

  async function submit(id: string) {
    setPendingId(id);
    const res = await submitRequisitionAction(id);
    setPendingId("");
    if (res.ok) {
      setDrawer(null);
      router.refresh();
    } else alert(res.error);
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta solicitação?")) return;
    setPendingId(id);
    const res = await deleteRequisitionAction(id);
    setPendingId("");
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "", label: "Todas" },
            { id: "aberta", label: "Abertas" },
            { id: "em_aprovacao", label: "Em aprovação" },
            { id: "aprovada", label: "Aprovadas" },
            { id: "rejeitada", label: "Rejeitadas" },
            { id: "convertida", label: "Convertidas" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                status === s.id
                  ? "bg-brand-500 text-ink-950"
                  : "border border-slate-200 text-slate-500 hover:text-brand-500 dark:border-ink-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" />
          Nova solicitação
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {status ? "Nenhuma solicitação neste status" : "Nenhuma solicitação ainda"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crie a primeira requisição de materiais.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Número</th>
                  <th className="px-5 py-2.5 font-medium">Solicitante</th>
                  <th className="px-5 py-2.5 font-medium">Centro de custo</th>
                  <th className="px-5 py-2.5 font-medium">Itens</th>
                  <th className="px-5 py-2.5 font-medium">Estimado</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40"
                  >
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openView(r.id)}
                        className="font-mono font-medium text-slate-700 hover:text-brand-500 dark:text-slate-200"
                      >
                        {r.number}
                      </button>
                      <p className="text-xs text-slate-400">{r.createdAt}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {r.requester || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {r.costCenter || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {r.itemsCount}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                      {brl(r.estimatedTotal)}
                    </td>
                    <td className="px-5 py-3">
                      <ReqStatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openView(r.id)}
                        className="text-xs font-medium text-brand-500 hover:underline"
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager param="pagina" meta={meta} />

      {drawer === "form" && (
        <Drawer
          title={editId ? "Editar solicitação" : "Nova solicitação"}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <button onClick={() => setDrawer(null)} className={btnGhost}>
                Cancelar
              </button>
              <button onClick={save} disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editId ? "Salvar" : "Criar solicitação"}
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Centro de custo</label>
              <select
                className={inputCls}
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
               aria-label="Centro de custo" >
                <option value="">— Sem centro de custo —</option>
                {costCenters
                  .filter((c) => c.active || c.id === costCenterId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.code ? ` (${c.code})` : ""}
                    </option>
                  ))}
              </select>
              {canManage && (
                <CostCenterAdd onAdded={() => router.refresh()} />
              )}
            </div>
            <div>
              <label className={labelCls}>Prioridade</label>
              <select
                className={inputCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
               aria-label="Prioridade" >
                {PRIORITY_OPTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Observações</label>
              <textarea
                className={`${inputCls} min-h-14`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
               aria-label="Observações" />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Itens
              </h3>
              <span className="text-xs text-slate-500">
                Estimado: <strong>{brl(estimatedTotal)}</strong>
              </span>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-3 dark:border-ink-700"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className={inputCls}
                      value={it.productId}
                      aria-label="Produto do item"
                      onChange={(e) => onPickProduct(i, e.target.value)}
                    >
                      <option value="">— Produto avulso —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls}
                      value={it.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="Descrição do item"
                     aria-label="Descrição do item" />
                    <input
                      className={inputCls}
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      inputMode="numeric"
                      placeholder="Quantidade"
                     aria-label="Quantidade" />
                    <input
                      className={inputCls}
                      value={it.estimatedUnitCost}
                      onChange={(e) =>
                        updateItem(i, { estimatedUnitCost: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="Custo unit. estimado"
                     aria-label="Custo unit. estimado" />
                    <select
                      className={inputCls}
                      value={it.priority}
                      aria-label="Prioridade do item"
                      onChange={(e) => updateItem(i, { priority: e.target.value })}
                    >
                      {PRIORITY_OPTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          Prioridade: {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls}
                      value={it.justification}
                      onChange={(e) =>
                        updateItem(i, { justification: e.target.value })
                      }
                      placeholder="Justificativa"
                     aria-label="Justificativa" />
                  </div>
                  {items.length > 1 && (
                    <button
                      onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover item
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setItems([...items, emptyItem()])}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item
            </button>
          </div>

          {error && <ErrorBox msg={error} />}
        </Drawer>
      )}

      {drawer === "view" && (
        <Drawer
          title={detail ? `Solicitação ${detail.number}` : "Carregando…"}
          onClose={() => setDrawer(null)}
          footer={
            detail && (
              <>
                {detail.status === "aberta" && (
                  <>
                    <button
                      onClick={() => remove(detail.id)}
                      disabled={pendingId === detail.id}
                      className={btnGhost}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                    <button onClick={() => openEdit(detail)} className={btnGhost}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => submit(detail.id)}
                      disabled={pendingId === detail.id}
                      className={btnPrimary}
                    >
                      {pendingId === detail.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar para aprovação
                    </button>
                  </>
                )}
                {detail.status !== "aberta" && (
                  <button onClick={() => setDrawer(null)} className={btnGhost}>
                    Fechar
                  </button>
                )}
              </>
            )
          }
        >
          {!detail ? (
            error ? (
              <ErrorBox msg={error} />
            ) : (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            )
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Solicitante" value={detail.requester || "—"} />
                <Info label="Centro de custo" value={detail.costCenter || "—"} />
                <Info label="Criada em" value={detail.createdAt} />
                <Info label="Status" value={reqStatusLabel(detail.status)} />
                <Info label="Prioridade" value={detail.priority} />
                <Info label="Total estimado" value={brl(detail.estimatedTotal)} />
              </div>
              {detail.note && (
                <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-ink-950 dark:text-slate-300">
                  {detail.note}
                </p>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Itens
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-ink-700">
                  <table className="w-full text-sm">
                    <tbody>
                      {detail.items.map((it) => (
                        <tr
                          key={it.id}
                          className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                        >
                          <td className="px-3 py-2">
                            <p className="text-slate-700 dark:text-slate-200">
                              {it.name}
                            </p>
                            {it.justification && (
                              <p className="text-xs text-slate-400">
                                {it.justification}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            {it.quantity} × {brl(it.estimatedUnitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {detail.approvals.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Aprovação
                  </h3>
                  <div className="space-y-2">
                    {detail.approvals.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-ink-700"
                      >
                        <ApprovalIcon status={a.status} />
                        <span className="flex-1 text-slate-700 dark:text-slate-200">
                          {approvalLevelLabel(a.level)}
                          {a.note && (
                            <span className="text-slate-400"> — {a.note}</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-400">
                          {a.approverName || a.at}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40";

function CostCenterAdd({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await createCostCenterAction({ name });
    setBusy(false);
    if (res.ok) {
      setName("");
      setOpen(false);
      onAdded();
    } else alert(res.error);
  }
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-brand-500 hover:underline"
      >
        + Novo centro de custo
      </button>
    );
  return (
    <div className="mt-1.5 flex gap-1.5">
      <input
        className={`${inputCls} py-1.5`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do centro de custo"
       aria-label="Nome do centro de custo" />
      <button onClick={add} disabled={busy} className="rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-ink-950">
        OK
      </button>
    </div>
  );
}

function Drawer({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-ink-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-ink-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-ink-800">
          {footer}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

function ReqStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberta: "bg-slate-400/15 text-slate-500",
    em_aprovacao: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    aprovada: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    rejeitada: "bg-red-500/15 text-red-500",
    convertida: "bg-brand-500/15 text-brand-600 dark:text-brand-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.aberta}`}>
      {reqStatusLabel(status)}
    </span>
  );
}

function ApprovalIcon({ status }: { status: string }) {
  if (status === "aprovado")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "rejeitado") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
}
