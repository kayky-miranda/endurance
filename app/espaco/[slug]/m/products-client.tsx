"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Minus,
  Loader2,
  AlertCircle,
  PackageOpen,
  Pencil,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
} from "lucide-react";
import {
  createProductAction,
  deleteProductAction,
  adjustStockAction,
  updateProductAction,
} from "./products-actions";
import { importProductsCsvAction } from "./csv-import-actions";
import CsvImportModal, { type CsvField } from "./csv-import-modal";
import { SortableTh, type SortState } from "./sortable-header";

const PRODUCT_CSV_FIELDS: CsvField[] = [
  { key: "name", label: "Nome", required: true, hints: ["nome", "produto", "descri"] },
  { key: "barcode", label: "Código de barras", hints: ["barra", "ean", "gtin"] },
  { key: "sku", label: "SKU", hints: ["sku", "codigo interno", "referencia"] },
  { key: "category", label: "Categoria", hints: ["categoria", "grupo", "setor"] },
  { key: "unit", label: "Unidade", hints: ["unidade", "un."] },
  { key: "ncm", label: "NCM", hints: ["ncm"] },
  { key: "price", label: "Preço", hints: ["preco", "venda", "valor"] },
  { key: "cost", label: "Custo", hints: ["custo", "compra"] },
  { key: "stock", label: "Estoque inicial", hints: ["estoque", "saldo", "quantidade", "qtd"] },
];

export type Product = {
  id: string;
  name: string;
  barcode: string;
  category: string;
  /** Campos fiscais — opcionais: nem todo consumidor do tipo os carrega (ex.: PDV). */
  ncm?: string;
  unit?: string;
  price: number;
  stock: number;
};

/**
 * Colunas ordenáveis da tabela de produtos. É uma WHITELIST: o valor vai
 * direto para o `orderBy` do Prisma, então nada que venha da URL pode
 * escapar desta lista.
 */
export const PRODUCT_SORT_FIELDS = [
  "name",
  "category",
  "price",
  "stock",
  "createdAt",
] as const;

const LOW_STOCK = 5;

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Paginação server-side: quando presente, a lista veio paginada do banco. */
export type ProductsPager = {
  total: number;
  page: number;
  pageSize: number;
  q: string;
  sort: SortState;
};

export default function ProductsClient({
  products,
  showAdd = true,
  pager,
}: {
  products: Product[];
  showAdd?: boolean;
  pager?: ProductsPager;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [ncm, setNcm] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await createProductAction({
      name,
      barcode,
      category,
      ncm,
      price: parseFloat(price.replace(",", ".")) || 0,
      stock: parseInt(stock, 10) || 0,
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setBarcode("");
      setCategory("");
      setNcm("");
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
              value={ncm}
              onChange={(e) => setNcm(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="NCM (8 díg., fiscal)"
              title="Código NCM do produto para emissão de nota fiscal. Deixe vazio para usar o NCM padrão da empresa."
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

      {pager && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ProductsSearch pager={pager} />
          </div>
          {showAdd && (
            <button
              onClick={() => setImporting(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
            >
              <UploadCloud className="h-4 w-4" /> Importar CSV
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {products.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <PackageOpen className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              {pager?.q ? "Nenhum produto encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {pager?.q
                ? "Ajuste a busca ou limpe o filtro para ver todos."
                : showAdd
                  ? "Adicione o primeiro produto no formulário acima."
                  : "Cadastre produtos no módulo Cadastro de produtos."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  {pager ? (
                    <>
                      <SortableTh field="name" label="Produto" sort={pager.sort} />
                      <SortableTh field="category" label="Categoria" sort={pager.sort} />
                      <SortableTh field="price" label="Preço" sort={pager.sort} />
                      <SortableTh field="stock" label="Estoque" sort={pager.sort} />
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-2.5 font-medium">Produto</th>
                      <th className="px-5 py-2.5 font-medium">Categoria</th>
                      <th className="px-5 py-2.5 font-medium">Preço</th>
                      <th className="px-5 py-2.5 font-medium">Estoque</th>
                    </>
                  )}
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
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(p)}
                            disabled={pending}
                            className="inline-grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600"
                            aria-label="Editar produto"
                            title="Editar produto"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(p.id)}
                            disabled={pending}
                            className="inline-grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500/60 hover:text-red-500 disabled:opacity-40 dark:border-ink-600"
                            aria-label="Remover"
                            title="Remover produto"
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pager && pager.total > pager.pageSize && <ProductsPagination pager={pager} />}
      </div>

      {importing && (
        <CsvImportModal
          title="Importar produtos por planilha"
          fields={PRODUCT_CSV_FIELDS}
          templateExample="Nome;Código de barras;SKU;Categoria;Unidade;NCM;Preço;Custo;Estoque"
          onImport={importProductsCsvAction}
          onClose={() => setImporting(false)}
          onDone={() => router.refresh()}
        />
      )}

      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

/** Busca server-side via URL (?q=) com debounce — a query roda no banco. */
function ProductsSearch({ pager }: { pager: ProductsPager }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(pager.q);
  const timer = useRef<number | null>(null);

  // Se a URL mudar por navegação (voltar/avançar), realinha o campo.
  useEffect(() => setTerm(pager.q), [pager.q]);

  function apply(value: string) {
    setTerm(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("pagina"); // busca nova volta para a primeira página
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
        scroll: false,
      });
    }, 350);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={term}
        onChange={(e) => apply(e.target.value)}
        placeholder="Buscar por nome, código de barras ou categoria…"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-100"
      />
    </div>
  );
}

function ProductsPagination({ pager }: { pager: ProductsPager }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(pager.total / pager.pageSize));
  const from = (pager.page - 1) * pager.pageSize + 1;
  const to = Math.min(pager.page * pager.pageSize, pager.total);

  function go(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("pagina", String(page));
    else params.delete("pagina");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-ink-800">
      <p className="text-slate-500 dark:text-slate-400">
        {from}–{to} de {pager.total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => go(pager.page - 1)}
          disabled={pager.page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand-500 disabled:opacity-30 dark:border-ink-600 dark:text-slate-300"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <span className="px-2 text-xs text-slate-400">
          {pager.page}/{pages}
        </span>
        <button
          onClick={() => go(pager.page + 1)}
          disabled={pager.page >= pages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand-500 disabled:opacity-30 dark:border-ink-600 dark:text-slate-300"
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [barcode, setBarcode] = useState(product.barcode);
  const [ncm, setNcm] = useState(product.ncm ?? "");
  const [unit, setUnit] = useState(product.unit || "un");
  const [price, setPrice] = useState(
    product.price ? String(product.price).replace(".", ",") : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    if (!name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await updateProductAction({
      id: product.id,
      name,
      category,
      barcode,
      ncm,
      unit,
      price: parseFloat(price.replace(",", ".")) || 0,
    });
    setBusy(false);
    if (res.ok) onSaved();
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="chippy-pop w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Editar produto
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              O estoque continua sendo ajustado pelos botões +/− na tabela.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Nome do produto
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Categoria
            </span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="—"
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Código de barras
            </span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              inputMode="numeric"
              placeholder="—"
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Preço (R$)
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Unidade
            </span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value.slice(0, 10))}
              placeholder="un"
              className={INPUT}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              NCM (8 díg., fiscal)
            </span>
            <input
              value={ncm}
              onChange={(e) => setNcm(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="Herda o NCM padrão da empresa se vazio"
              className={INPUT}
            />
          </label>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
