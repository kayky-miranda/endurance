"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  History,
} from "lucide-react";
import { searchForTransferAction, transferStockAction } from "./transfers-actions";

type Loc = { id: string; name: string; code: string; isDefault: boolean };
type Found = { id: string; name: string; barcode: string; qty: number };
type Hist = {
  id: string;
  product: string;
  qty: number;
  when: string;
  user: string;
  note: string;
};

export default function TransfersClient({
  locations,
  history,
  reasonLabel,
}: {
  locations: Loc[];
  history: Hist[];
  reasonLabel: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(locations[0]?.id ?? "");
  const [to, setTo] = useState(locations[1]?.id ?? "");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const enough = locations.length >= 2;

  async function search(term: string) {
    setQ(term);
    setPicked(null);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await searchForTransferAction(term, from);
    if (res.ok) setResults(res.products ?? []);
  }

  function submit() {
    if (!picked) return;
    const n = Math.trunc(Number(qty) || 0);
    if (n <= 0) {
      setMsg({ tone: "err", text: "Informe uma quantidade maior que zero." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await transferStockAction({
        productId: picked.id,
        fromLocationId: from,
        toLocationId: to,
        quantity: n,
        note,
      });
      if (res.ok) {
        setMsg({
          tone: "ok",
          text: `${n} un. de ${picked.name} transferida(s) com sucesso.`,
        });
        setPicked(null);
        setQ("");
        setResults([]);
        setQty("1");
        setNote("");
        router.refresh();
      } else setMsg({ tone: "err", text: res.error ?? "Não foi possível transferir." });
    });
  }

  if (!enough)
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-700 dark:text-amber-300">
        <p className="font-semibold">Cadastre ao menos dois locais</p>
        <p className="mt-1 text-xs">
          A transferência move estoque entre locais diferentes. Crie filiais ou
          depósitos em <strong>Configurações → Locais de estoque</strong>.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            msg.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {msg.tone === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {/* Origem → destino */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">De</span>
            <select
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPicked(null);
                setResults([]);
                setQ("");
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight className="mb-3 h-5 w-5 shrink-0 text-brand-500" />
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Para</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            >
              {locations
                .filter((l) => l.id !== from)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {/* Produto */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={picked ? picked.name : q}
            onChange={(e) => search(e.target.value)}
            placeholder="Buscar produto por nome, código de barras ou SKU…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
           aria-label="Buscar produto por nome, código de barras ou SKU" />
          {results.length > 0 && !picked && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPicked(p);
                    setResults([]);
                  }}
                  disabled={p.qty <= 0}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-ink-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700 dark:text-slate-200">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {p.barcode || "sem código"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${p.qty > 0 ? "text-slate-400" : "text-rose-500"}`}
                  >
                    {p.qty} un. na origem
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="w-32">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Quantidade (máx. {picked.qty})
              </span>
              <input
                type="number"
                min={1}
                max={picked.qty}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
            <label className="min-w-48 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Observação (opcional)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: reposição da vitrine"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
               aria-label="Ex.: reposição da vitrine" />
            </label>
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4" />
              )}
              Transferir
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          A transferência sai de um local e entra no outro na mesma operação,
          registrada no razão como “{reasonLabel}”. O total da empresa não muda.
        </p>
      </div>

      {/* Histórico */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <p className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <History className="h-4 w-4 text-slate-400" /> Últimas transferências
        </p>
        {history.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-slate-500">
            Nenhuma transferência registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Produto</th>
                  <th className="px-5 py-2.5 font-medium text-center">Qtd.</th>
                  <th className="px-5 py-2.5 font-medium">Rota</th>
                  <th className="px-5 py-2.5 font-medium">Quando</th>
                  <th className="px-5 py-2.5 font-medium">Por</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                  >
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {h.product}
                    </td>
                    <td className="px-5 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                      {h.qty}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {h.note || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {h.when}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {h.user}
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
