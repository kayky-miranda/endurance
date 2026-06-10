"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Barcode,
  Sparkles,
  Loader2,
  Check,
  Printer,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { generateBarcodeAction, setBarcodeAction } from "./barcode-actions";
import BarcodeSvg from "./barcode-svg";

type P = {
  id: string;
  name: string;
  price: number;
  category: string;
  barcode: string;
  stock: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CodigoBarrasClient({
  slug,
  products,
  canManage,
}: {
  slug: string;
  products: P[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editId, setEditId] = useState("");
  const [editVal, setEditVal] = useState("");
  const [error, setError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, query]);

  const withCode = products.filter((p) => p.barcode).length;
  const totalLabels = Object.values(qty).reduce((a, n) => a + (n || 0), 0);

  async function generate(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await generateBarcodeAction(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    } finally {
      setBusyId("");
    }
  }

  async function saveManual(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await setBarcodeAction(id, editVal);
      if (res.ok) {
        setEditId("");
        setEditVal("");
        router.refresh();
      } else setError(res.error);
    } finally {
      setBusyId("");
    }
  }

  function printLabels() {
    const items = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${id}:${n}`)
      .join(",");
    if (!items) return;
    window.open(
      `/espaco/${slug}/etiquetas?items=${encodeURIComponent(items)}`,
      "_blank",
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Produtos" value={products.length} />
        <Stat label="Com código" value={withCode} tone="emerald" />
        <Stat label="Sem código" value={products.length - withCode} tone="amber" />
      </div>

      {/* Busca + imprimir */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto ou código…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={printLabels}
          disabled={totalLabels === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          Imprimir etiquetas{totalLabels > 0 ? ` (${totalLabels})` : ""}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2.5">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-ink-700">
            Nenhum produto encontrado.
          </p>
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="min-w-[160px] flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {p.name}
              </p>
              <p className="text-xs text-slate-500">
                {brl(p.price)}
                {p.category ? ` · ${p.category}` : ""} · {p.stock} un
              </p>
            </div>

            {/* Código de barras / ações */}
            <div className="flex items-center gap-3">
              {p.barcode ? (
                <div className="rounded-lg bg-white p-1.5 ring-1 ring-slate-100 dark:ring-ink-700">
                  <BarcodeSvg value={p.barcode} moduleWidth={1.6} height={44} />
                </div>
              ) : editId === p.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    placeholder="Código"
                    className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                  />
                  <button
                    onClick={() => saveManual(p.id)}
                    disabled={busyId === p.id}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-ink-950 disabled:opacity-40"
                  >
                    {busyId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-xs italic text-slate-400">Sem código</span>
              )}

              {canManage && (
                <div className="flex items-center gap-1.5">
                  {!p.barcode && editId !== p.id && (
                    <>
                      <button
                        onClick={() => generate(p.id)}
                        disabled={busyId === p.id}
                        title="Gerar código automático"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
                      >
                        {busyId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Gerar
                      </button>
                      <button
                        onClick={() => {
                          setEditId(p.id);
                          setEditVal("");
                          setError("");
                        }}
                        title="Digitar código"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {p.barcode && (
                    <button
                      onClick={() => {
                        setEditId(p.id);
                        setEditVal(p.barcode);
                      }}
                      title="Editar código"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Quantidade de etiquetas */}
              {p.barcode && (
                <div className="flex items-center gap-1.5">
                  <Barcode className="h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    value={qty[p.id] ?? 0}
                    onChange={(e) =>
                      setQty((q) => ({
                        ...q,
                        [p.id]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    title="Quantidade de etiquetas para imprimir"
                    className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: number;
  tone?: "brand" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-600 dark:text-brand-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900">
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
