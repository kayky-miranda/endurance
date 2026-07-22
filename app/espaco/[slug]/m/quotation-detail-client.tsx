"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Star,
  Trophy,
  BadgeDollarSign,
  Truck,
  Check,
} from "lucide-react";
import type { QuotationDetail } from "@/lib/endurance/quotations";
import { saveSupplierBidAction, chooseWinnerAction } from "./quotations-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Draft = {
  paymentTerm: string;
  leadTimeDays: string;
  prices: Record<string, string>; // itemId -> price string
};

export default function QuotationDetailClient({
  slug,
  detail,
}: {
  slug: string;
  detail: QuotationDetail;
}) {
  const router = useRouter();
  const closed = detail.status === "fechada" || detail.status === "cancelada";

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const d: Record<string, Draft> = {};
    for (const s of detail.suppliers) {
      d[s.id] = {
        paymentTerm: s.paymentTerm,
        leadTimeDays: s.leadTimeDays ? String(s.leadTimeDays) : "",
        prices: Object.fromEntries(
          detail.items.map((it) => [
            it.id,
            s.prices[it.id] != null ? String(s.prices[it.id]) : "",
          ]),
        ),
      };
    }
    return d;
  });
  const [busy, setBusy] = useState("");

  function setPrice(qsId: string, itemId: string, value: string) {
    setDrafts((d) => ({
      ...d,
      [qsId]: { ...d[qsId], prices: { ...d[qsId].prices, [itemId]: value } },
    }));
  }
  function setField(qsId: string, key: "paymentTerm" | "leadTimeDays", value: string) {
    setDrafts((d) => ({ ...d, [qsId]: { ...d[qsId], [key]: value } }));
  }

  function liveTotal(qsId: string): number {
    const d = drafts[qsId];
    return detail.items.reduce((a, it) => {
      const price = parseFloat((d.prices[it.id] ?? "").replace(",", ".")) || 0;
      return a + it.quantity * price;
    }, 0);
  }

  async function saveBid(qsId: string) {
    setBusy(qsId);
    const d = drafts[qsId];
    const res = await saveSupplierBidAction(detail.id, qsId, {
      paymentTerm: d.paymentTerm,
      leadTimeDays: parseInt(d.leadTimeDays, 10) || 0,
      prices: detail.items.map((it) => ({
        quotationItemId: it.id,
        unitPrice: parseFloat((d.prices[it.id] ?? "").replace(",", ".")) || 0,
      })),
    });
    setBusy("");
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function pickWinner(supplierId: string) {
    if (!confirm("Escolher este fornecedor como vencedor e fechar a cotação?")) return;
    setBusy(supplierId);
    const res = await chooseWinnerAction(detail.id, supplierId);
    setBusy("");
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-ink-800">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
              Item
            </th>
            {detail.suppliers.map((s) => (
              <th key={s.id} className="px-4 py-3 text-left align-top">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {s.name}
                  </span>
                  {s.isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-slate-400">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {s.rating.toFixed(1)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.bestPrice && (
                    <Badge icon={BadgeDollarSign} tone="emerald">
                      Menor preço
                    </Badge>
                  )}
                  {s.bestLead && (
                    <Badge icon={Truck} tone="sky">
                      Menor prazo
                    </Badge>
                  )}
                  {s.bestRating && (
                    <Badge icon={Star} tone="amber">
                      Melhor avaliação
                    </Badge>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100 dark:border-ink-800">
              <td className="px-4 py-2.5">
                <p className="text-slate-700 dark:text-slate-200">{it.name}</p>
                <p className="text-xs text-slate-400">Qtd: {it.quantity}</p>
              </td>
              {detail.suppliers.map((s) => (
                <td key={s.id} className="px-4 py-2.5">
                  <input
                    value={drafts[s.id].prices[it.id] ?? ""}
                    onChange={(e) => setPrice(s.id, it.id, e.target.value)}
                    disabled={closed}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                   aria-label="0,00" />
                </td>
              ))}
            </tr>
          ))}

          {/* Prazo de entrega */}
          <tr className="border-b border-slate-100 dark:border-ink-800">
            <td className="px-4 py-2.5 text-xs font-medium text-slate-500">
              Prazo de entrega (dias)
            </td>
            {detail.suppliers.map((s) => (
              <td key={s.id} className="px-4 py-2.5">
                <input
                  value={drafts[s.id].leadTimeDays}
                  onChange={(e) => setField(s.id, "leadTimeDays", e.target.value)}
                  disabled={closed}
                  inputMode="numeric"
                  placeholder="—"
                  className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                 aria-label="—" />
              </td>
            ))}
          </tr>

          {/* Condição de pagamento */}
          <tr className="border-b border-slate-100 dark:border-ink-800">
            <td className="px-4 py-2.5 text-xs font-medium text-slate-500">
              Condição de pagamento
            </td>
            {detail.suppliers.map((s) => (
              <td key={s.id} className="px-4 py-2.5">
                <input
                  value={drafts[s.id].paymentTerm}
                  onChange={(e) => setField(s.id, "paymentTerm", e.target.value)}
                  disabled={closed}
                  placeholder="ex.: 30 dias"
                  className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                 aria-label="ex.: 30 dias" />
              </td>
            ))}
          </tr>

          {/* Total */}
          <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-ink-800 dark:bg-ink-800/40">
            <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total
            </td>
            {detail.suppliers.map((s) => (
              <td
                key={s.id}
                className={`px-4 py-3 font-bold ${
                  s.bestPrice
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {brl(liveTotal(s.id))}
              </td>
            ))}
          </tr>

          {/* Ações */}
          <tr>
            <td className="px-4 py-3" />
            {detail.suppliers.map((s) => (
              <td key={s.id} className="px-4 py-3">
                {closed ? (
                  s.isWinner ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Trophy className="h-3.5 w-3.5" /> Vencedor
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => saveBid(s.id)}
                      disabled={busy === s.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
                    >
                      {busy === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </button>
                    <button
                      onClick={() => pickWinner(s.supplierId)}
                      disabled={busy === s.supplierId || s.total <= 0}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      Escolher
                    </button>
                  </div>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Badge({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Star;
  tone: "emerald" | "sky" | "amber";
  children: React.ReactNode;
}) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${map[tone]}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
