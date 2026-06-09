"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  Plus,
  Loader2,
  PackageCheck,
  Trash2,
  Sparkles,
  ChevronDown,
  Building2,
  Send,
} from "lucide-react";
import {
  createSupplierAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
} from "./purchasing-actions";
import type {
  SupplierRow,
  OrderRow,
  ProductPick,
  SuggestedItem,
} from "@/lib/endurance/purchasing";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

const STATUS: Record<OrderRow["status"], { label: string; cls: string }> = {
  enviado: {
    label: "Enviado",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  recebido: {
    label: "Recebido",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

interface POItem {
  productId: string | null;
  name: string;
  quantity: number;
  unitCost: number;
}

export default function PurchasingClient({
  slug,
  suppliers,
  orders,
  products,
  suggestion,
}: {
  slug: string;
  suppliers: SupplierRow[];
  orders: OrderRow[];
  products: ProductPick[];
  suggestion: SuggestedItem[];
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function receive(orderId: string) {
    setBusy(orderId);
    setErr(null);
    const res = await receivePurchaseOrderAction(orderId);
    setBusy(null);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "Falha ao receber.");
  }

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <NewOrder
          suppliers={suppliers}
          products={products}
          suggestion={suggestion}
          onSaved={() => router.refresh()}
        />
        <Suppliers suppliers={suppliers} onSaved={() => router.refresh()} />
      </div>

      <OrdersTable slug={slug} orders={orders} busy={busy} receive={receive} />
    </div>
  );
}

function NewOrder({
  suppliers,
  products,
  suggestion,
  onSaved,
}: {
  suppliers: SupplierRow[];
  products: ProductPick[];
  suggestion: SuggestedItem[];
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [items, setItems] = useState<POItem[]>([]);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setItems((prev) =>
      prev.some((i) => i.productId === id)
        ? prev
        : [...prev, { productId: p.id, name: p.name, quantity: 1, unitCost: p.cost }],
    );
    setPick("");
  }
  function useSuggestion() {
    if (suggestion.length === 0) return;
    setItems(
      suggestion.map((s) => ({
        productId: s.productId,
        name: s.name,
        quantity: s.quantity,
        unitCost: s.unitCost,
      })),
    );
  }
  function update(idx: number, patch: Partial<POItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function save() {
    setErr(null);
    start(async () => {
      const res = await createPurchaseOrderAction(supplierId, items, note);
      if (res.ok) {
        setItems([]);
        setNote("");
        onSaved();
      } else setErr(res.error ?? "Falha ao criar pedido.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Plus className="h-4 w-4 text-brand-500" />
        Novo pedido de compra
      </h2>

      {suppliers.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400 dark:bg-ink-950">
          Cadastre um fornecedor primeiro.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputCls}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={pick}
              onChange={(e) => addProduct(e.target.value)}
              className={`${inputCls} flex-1`}
            >
              <option value="">+ Adicionar produto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (est. {p.stock})
                </option>
              ))}
            </select>
            {suggestion.length > 0 && (
              <button
                onClick={useSuggestion}
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-xs font-medium text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
                title="Preencher com a reposição sugerida"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Usar sugestão ({suggestion.length})
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-100 p-2 dark:border-ink-800">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {it.name}
                  </span>
                  <input
                    type="number"
                    value={it.quantity}
                    onChange={(e) =>
                      update(idx, { quantity: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm dark:border-ink-600 dark:bg-ink-950"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unitCost}
                    onChange={(e) =>
                      update(idx, { unitCost: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-sm dark:border-ink-600 dark:bg-ink-950"
                  />
                  <span className="w-20 text-right text-sm font-medium text-slate-600 dark:text-slate-300">
                    {brl(it.quantity * it.unitCost)}
                  </span>
                  <button
                    onClick={() => remove(idx)}
                    className="text-slate-400 transition hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold dark:border-ink-800">
                <span>Total do pedido</span>
                <span>{brl(total)}</span>
              </div>
            </div>
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional)"
            className={inputCls}
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            onClick={save}
            disabled={pending || items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar pedido
          </button>
        </div>
      )}
    </div>
  );
}

function Suppliers({
  suppliers,
  onSaved,
}: {
  suppliers: SupplierRow[];
  onSaved: () => void;
}) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await createSupplierAction({ name, cnpj, phone, email });
      if (res.ok) {
        setName("");
        setCnpj("");
        setPhone("");
        setEmail("");
        setShow(false);
        onSaved();
      } else setErr(res.error ?? "Falha ao salvar.");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Building2 className="h-4 w-4 text-brand-500" />
          Fornecedores
        </h2>
        <button
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </button>
      </div>

      {show && (
        <div className="mb-3 space-y-2 rounded-xl border border-slate-100 p-3 dark:border-ink-800">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome / razão social" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="CNPJ" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className={inputCls} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            onClick={save}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar fornecedor
          </button>
        </div>
      )}

      {suppliers.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhum fornecedor cadastrado.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-ink-800">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                  {s.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[s.cnpj, s.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-xs text-slate-400">{s.orders} pedidos</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTable({
  slug,
  orders,
  busy,
  receive,
}: {
  slug: string;
  orders: OrderRow[];
  busy: string | null;
  receive: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Pedidos de compra
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Pedido</th>
              <th className="px-5 py-2.5 font-medium">Fornecedor</th>
              <th className="px-5 py-2.5 font-medium">Itens</th>
              <th className="px-5 py-2.5 font-medium">Total</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  Nenhum pedido ainda.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const st = STATUS[o.status];
              const expanded = open === o.id;
              return (
                <Fragment key={o.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-ink-800 dark:hover:bg-ink-800/40"
                    onClick={() => setOpen(expanded ? null : o.id)}
                  >
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1">
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
                        />
                        {o.code}
                      </span>
                      <span className="block pl-5 text-xs text-slate-400">
                        {o.createdAt}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {o.supplier}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {o.itemsCount}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {brl(o.total)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/espaco/${slug}/pedido/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                        title={o.sentAt ? `Enviado ${o.sentAt}` : "Enviar ao fornecedor"}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {o.sentAt ? "Reenviar" : "Enviar"}
                      </Link>
                      {o.status === "enviado" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            receive(o.id);
                          }}
                          disabled={busy === o.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-40"
                        >
                          {busy === o.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PackageCheck className="h-3.5 w-3.5" />
                          )}
                          Receber
                        </button>
                      )}
                      {o.receivedAt && (
                        <span className="text-xs text-slate-400">
                          recebido {o.receivedAt}
                        </span>
                      )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50/60 dark:bg-ink-950/40">
                      <td colSpan={6} className="px-5 py-3">
                        <div className="space-y-1">
                          {o.items.map((it, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-slate-500 dark:text-slate-400"
                            >
                              <span>
                                {it.quantity}× {it.name}
                              </span>
                              <span>
                                {brl(it.unitCost)} un · {brl(it.quantity * it.unitCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
