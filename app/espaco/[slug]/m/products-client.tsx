"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Minus,
  Loader2,
  AlertCircle,
  PackageOpen,
} from "lucide-react";
import {
  createProductAction,
  deleteProductAction,
  adjustStockAction,
} from "./products-actions";

export type Product = {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
};

const LOW_STOCK = 5;

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductsClient({
  products,
  showAdd = true,
}: {
  products: Product[];
  showAdd?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  async function add() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await createProductAction({
      name,
      barcode,
      category,
      price: parseFloat(price.replace(",", ".")) || 0,
      stock: parseInt(stock, 10) || 0,
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setBarcode("");
      setCategory("");
      setPrice("");
      setStock("");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function adjust(id: string, delta: number) {
    setPendingId(id);
    await adjustStockAction(id, delta);
    setPendingId("");
    router.refresh();
  }

  async function remove(id: string) {
    setPendingId(id);
    await deleteProductAction(id);
    setPendingId("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {showAdd && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do produto"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              inputMode="numeric"
              placeholder="Código de barras"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Categoria"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="Preço (R$)"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              inputMode="numeric"
              placeholder="Estoque inicial"
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </div>
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Adicionar produto
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {products.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <PackageOpen className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhum produto ainda
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {showAdd
                ? "Adicione o primeiro produto no formulário acima."
                : "Cadastre produtos no módulo Cadastro de produtos."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Produto</th>
                  <th className="px-5 py-2.5 font-medium">Categoria</th>
                  <th className="px-5 py-2.5 font-medium">Preço</th>
                  <th className="px-5 py-2.5 font-medium">Estoque</th>
                  <th className="px-5 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = p.stock <= LOW_STOCK;
                  const pending = pendingId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {p.name}
                        </p>
                        {p.barcode && (
                          <p className="font-mono text-xs text-slate-400">
                            {p.barcode}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {p.category || "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                        {brl(p.price)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjust(p.id, -1)}
                            disabled={pending || p.stock === 0}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-brand-500 disabled:opacity-30 dark:border-ink-600"
                            aria-label="Diminuir estoque"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span
                            className={`min-w-8 text-center font-semibold ${
                              low
                                ? "text-red-500"
                                : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {p.stock}
                          </span>
                          <button
                            onClick={() => adjust(p.id, 1)}
                            disabled={pending}
                            className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-brand-500 disabled:opacity-30 dark:border-ink-600"
                            aria-label="Aumentar estoque"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          {low && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
                              baixo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => remove(p.id)}
                          disabled={pending}
                          className="inline-grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500/60 hover:text-red-500 disabled:opacity-40 dark:border-ink-600"
                          aria-label="Remover"
                        >
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
