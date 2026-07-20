"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { CountDetail } from "@/lib/endurance/stock-count";

/**
 * Folha de impressão: na tela mostra uma prévia limpa com botão Imprimir; no
 * papel, o CSS abaixo esconde TUDO (shell, sidebar, widgets) e imprime só a
 * folha — funciona independente do layout que envolve a página.
 */
export default function PrintSheet({
  slug,
  count,
  typeLabel,
  statusLabel,
}: {
  slug: string;
  count: CountDetail;
  typeLabel: string;
  statusLabel: string;
}) {
  const counted = count.items.filter((i) => i.countedQty != null);
  const divergent = counted.filter((i) => (i.countedQty as number) !== i.systemQty);
  const divValue = divergent.reduce(
    (s, i) => s + Math.abs((i.countedQty as number) - i.systemQty) * i.unitCost,
    0,
  );
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <style>{`@media print {
        body * { visibility: hidden; }
        #folha-conferencia, #folha-conferencia * { visibility: visible; }
        #folha-conferencia { position: absolute; left: 0; top: 0; width: 100%; }
      }`}</style>

      {/* Barra de ações (só na tela) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/espaco/${slug}/m/conferencia/${count.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-500"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à conferência
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      {/* Folha */}
      <div
        id="folha-conferencia"
        className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="font-mono text-xl font-bold">{count.number}</h1>
            <p className="text-sm text-slate-500">
              Conferência de estoque — {typeLabel}
              {count.blind ? " · cega" : ""} · {statusLabel}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Criada em {dt(count.createdAt)}</p>
            {count.approvedAt && <p>Aprovada em {dt(count.approvedAt)}</p>}
            {count.adjustedAt && <p>Ajustada em {dt(count.adjustedAt)}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-sm sm:grid-cols-3">
          <p><span className="text-slate-500">Local:</span> {count.location || "—"}</p>
          <p><span className="text-slate-500">Responsável:</span> {count.responsibleName || "—"}</p>
          <p><span className="text-slate-500">Criada por:</span> {count.createdByName}</p>
          <p><span className="text-slate-500">Aprovada por:</span> {count.approvedByName || "—"}</p>
          <p><span className="text-slate-500">Itens contados:</span> {counted.length}/{count.items.length}</p>
          <p><span className="text-slate-500">Divergências:</span> {divergent.length} ({brl(divValue)})</p>
        </div>
        {count.note && (
          <p className="pb-3 text-sm"><span className="text-slate-500">Observação:</span> {count.note}</p>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-2 font-medium">Produto</th>
              <th className="py-2 pr-2 font-medium">Código</th>
              <th className="py-2 pr-2 text-center font-medium">Sistema</th>
              <th className="py-2 pr-2 text-center font-medium">Físico</th>
              <th className="py-2 pr-2 text-center font-medium">Diverg.</th>
              <th className="py-2 text-right font-medium">Valor diverg.</th>
            </tr>
          </thead>
          <tbody>
            {count.items.map((it) => {
              const div = it.countedQty == null ? null : it.countedQty - it.systemQty;
              return (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">{it.productName}</td>
                  <td className="py-1.5 pr-2 font-mono text-xs">{it.barcode || it.sku || "—"}</td>
                  <td className="py-1.5 pr-2 text-center">{it.systemQty}</td>
                  <td className="py-1.5 pr-2 text-center font-semibold">{it.countedQty ?? "—"}</td>
                  <td className={`py-1.5 pr-2 text-center font-semibold ${div ? "text-rose-600" : ""}`}>
                    {div == null ? "—" : div === 0 ? "0" : `${div > 0 ? "+" : ""}${div}`}
                  </td>
                  <td className="py-1.5 text-right">
                    {div == null || div === 0 ? "—" : brl(Math.abs(div) * it.unitCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-10 grid grid-cols-2 gap-12 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">
            Assinatura do responsável pela contagem
          </div>
          <div className="border-t border-slate-400 pt-1">
            Assinatura do aprovador
          </div>
        </div>
      </div>
    </div>
  );
}
