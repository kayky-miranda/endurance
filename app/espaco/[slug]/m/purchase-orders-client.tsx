"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Loader2,
  X,
  ShoppingCart,
  Send,
  CheckCircle2,
  Ban,
  Share2,
  Truck,
} from "lucide-react";
import Pager from "./pager";
import type { PageMeta } from "@/lib/endurance/pagination";
import type { PoRow, PoDetail } from "@/lib/endurance/purchase-orders";
import { poStatusLabel, poIsOpen } from "@/lib/endurance/purchase-order-status";
import {
  generateOrderAction,
  sendOrderAction,
  confirmOrderAction,
  cancelOrderAction,
  loadOrderAction,
} from "./purchase-orders-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type OrderableQuote = {
  id: string;
  number: string;
  supplier: string;
  total: number;
  itemsCount: number;
};

export default function PurchaseOrdersClient({
  slug,
  rows,
  meta,
  status,
  orderable,
}: {
  slug: string;
  rows: PoRow[];
  meta: PageMeta;
  status: string;
  orderable: OrderableQuote[];
}) {
  const router = useRouter();
  const [gen, setGen] = useState(false);
  const [genId, setGenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<PoDetail | null>(null);
  const [view, setView] = useState(false);

  function setStatusFilter(s: string) {
    const url = new URL(window.location.href);
    if (s) url.searchParams.set("status", s);
    else url.searchParams.delete("status");
    url.searchParams.delete("pagina");
    router.replace(url.pathname + url.search, { scroll: false });
  }

  async function generate() {
    if (!genId || busy) return;
    setBusy(true);
    const res = await generateOrderAction(genId);
    setBusy(false);
    if (res.ok) {
      setGen(false);
      setGenId("");
      router.refresh();
      if (res.id) openView(res.id);
    } else alert(res.error);
  }

  async function openView(id: string) {
    setView(true);
    setDetail(null);
    const res = await loadOrderAction(id);
    if (res.ok && res.detail) setDetail(res.detail);
    else {
      setView(false);
      alert(res.error);
    }
  }

  async function act(
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
    id: string,
  ) {
    setBusy(true);
    const res = await fn(id);
    setBusy(false);
    if (res.ok) {
      router.refresh();
      await openView(id);
    } else alert(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "", label: "Todos" },
            { id: "aberto", label: "Abertos" },
            { id: "enviado", label: "Enviados" },
            { id: "confirmado", label: "Confirmados" },
            { id: "recebido", label: "Recebidos" },
            { id: "cancelado", label: "Cancelados" },
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
          onClick={() => {
            setGen(true);
            setGenId("");
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" />
          Gerar pedido
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {status ? "Nenhum pedido neste status" : "Nenhum pedido de compra ainda"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Gere um pedido a partir de uma cotação fechada.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Pedido</th>
                  <th className="px-5 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-5 py-2.5 font-medium">Itens</th>
                  <th className="px-5 py-2.5 font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">Entrega prev.</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-ink-800 dark:hover:bg-ink-800/40"
                  >
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openView(o.id)}
                        className="font-mono font-medium text-slate-700 hover:text-brand-500 dark:text-slate-200"
                      >
                        {o.code}
                      </button>
                      <p className="text-xs text-slate-400">{o.createdAt}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {o.supplier}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {o.itemsCount}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {brl(o.total)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {o.expectedDate ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <PoBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openView(o.id)}
                        className="text-xs font-medium text-brand-500 hover:underline"
                      >
                        Detalhes
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

      {/* Drawer: gerar pedido da cotação */}
      {gen && (
        <Drawer title="Gerar pedido de compra" onClose={() => setGen(false)}>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escolha uma cotação fechada. O pedido é criado com o fornecedor
              vencedor e seus preços.
            </p>
            {orderable.length === 0 ? (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                Nenhuma cotação fechada disponível. Feche uma cotação escolhendo o
                vencedor primeiro.
              </p>
            ) : (
              <div className="space-y-1.5">
                {orderable.map((q) => (
                  <label
                    key={q.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                      genId === q.id
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-slate-200 hover:border-brand-500/50 dark:border-ink-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quote"
                      checked={genId === q.id}
                      onChange={() => setGenId(q.id)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">
                        {q.number}
                      </p>
                      <p className="text-xs text-slate-400">
                        {q.supplier} · {q.itemsCount} itens
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {brl(q.total)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DrawerFooter>
            <button onClick={() => setGen(false)} className={btnGhost}>
              Cancelar
            </button>
            <button onClick={generate} disabled={busy || !genId} className={btnPrimary}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar pedido
            </button>
          </DrawerFooter>
        </Drawer>
      )}

      {/* Drawer: detalhe do pedido */}
      {view && (
        <Drawer
          title={detail ? `Pedido ${detail.code}` : "Carregando…"}
          onClose={() => setView(false)}
        >
          {!detail ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="flex items-center justify-between">
                  <PoBadge status={detail.status} />
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {brl(detail.total)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Fornecedor" value={detail.supplier.name} />
                  <Info label="Pagamento" value={detail.paymentTerm || "—"} />
                  <Info label="Criado em" value={detail.createdAt} />
                  <Info label="Entrega prev." value={detail.expectedDate ?? "—"} />
                  {detail.sentAt && (
                    <Info label="Enviado" value={`${detail.sentAt}${detail.sentVia ? ` (${detail.sentVia})` : ""}`} />
                  )}
                  {detail.confirmedAt && (
                    <Info label="Confirmado" value={detail.confirmedAt} />
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-ink-700">
                  <table className="w-full text-sm">
                    <tbody>
                      {detail.items.map((it) => (
                        <tr
                          key={it.id}
                          className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                        >
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {it.name}
                            {it.receivedQty > 0 && (
                              <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                ({it.receivedQty}/{it.quantity} recebido)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            {it.quantity} × {brl(it.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Link
                  href={`/espaco/${slug}/pedido/${detail.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:underline"
                >
                  <Share2 className="h-4 w-4" />
                  Abrir pedido (PDF / WhatsApp / e-mail)
                </Link>
              </div>

              <DrawerFooter>
                {poIsOpen(detail.status) ? (
                  <>
                    <button
                      onClick={() => act(cancelOrderAction, detail.id)}
                      disabled={busy}
                      className={btnGhost}
                    >
                      <Ban className="h-4 w-4" />
                      Cancelar
                    </button>
                    {(detail.status === "aberto" || detail.status === "enviado") && (
                      <button
                        onClick={() => act((id) => sendOrderAction(id, "manual"), detail.id)}
                        disabled={busy}
                        className={btnGhost}
                      >
                        <Send className="h-4 w-4" />
                        Marcar enviado
                      </button>
                    )}
                    {(detail.status === "aberto" || detail.status === "enviado") && (
                      <button
                        onClick={() => act(confirmOrderAction, detail.id)}
                        disabled={busy}
                        className={btnPrimary}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Confirmar
                      </button>
                    )}
                    {detail.status === "confirmado" && (
                      <Link
                        href={`/espaco/${slug}/m/recebimento`}
                        className={btnPrimary}
                      >
                        <Truck className="h-4 w-4" />
                        Ir para recebimento
                      </Link>
                    )}
                  </>
                ) : (
                  <button onClick={() => setView(false)} className={btnGhost}>
                    Fechar
                  </button>
                )}
              </DrawerFooter>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}

const btnGhost =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300 dark:hover:bg-ink-800";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40";

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-ink-900">
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
        {children}
      </div>
    </div>
  );
}

function DrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-ink-800">
      {children}
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

function PoBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberto: "bg-slate-400/15 text-slate-500",
    enviado: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    confirmado: "bg-brand-500/15 text-brand-600 dark:text-brand-400",
    parcial: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    recebido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    cancelado: "bg-red-500/15 text-red-500",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.aberto}`}>
      {poStatusLabel(status)}
    </span>
  );
}
