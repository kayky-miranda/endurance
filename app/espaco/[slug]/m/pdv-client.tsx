"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  UserPlus,
  User,
  X,
  Sparkles,
  Tag,
  Package,
  Printer,
  QrCode,
  Copy,
  MessageCircle,
  Send,
} from "lucide-react";
import type { Product } from "./products-client";
import {
  finalizeSaleAction,
  createCustomerAction,
  suggestCrossSellAction,
  quickCreateProductAction,
  type CustomerData,
} from "./pdv-actions";
import {
  createPixChargeAction,
  getPixChargeStatusAction,
  confirmSimulatedPixAction,
  cancelPixChargeAction,
} from "./pix-actions";
import { sendSaleReceiptAction } from "./whatsapp-actions";
import type { PixChargeView } from "@/lib/endurance/pix-service";
import { useModalA11y } from "../use-modal-a11y";

type Suggestion = { id: string; name: string; price: number; reason: string };

const METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito", label: "Crédito" },
  { key: "debito", label: "Débito" },
  { key: "pix", label: "Pix" },
];

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
const round2 = (n: number) => Math.round(n * 100) / 100;
function newToken() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export default function PdvClient({
  products,
  slug,
  pixHasDevice = false,
  canManageProducts = false,
}: {
  products: Product[];
  slug: string;
  pixHasDevice?: boolean;
  canManageProducts?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [lastSaleId, setLastSaleId] = useState("");
  const [lastSalePhone, setLastSalePhone] = useState("");
  const [lastSaleName, setLastSaleName] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const tokenRef = useRef(newToken());
  const searchRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);

  // cliente
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // desconto e pagamentos
  const [discType, setDiscType] = useState<"value" | "percent">("value");
  const [discInput, setDiscInput] = useState("");
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>(
    [],
  );

  // cobrança PIX (fluxo assíncrono: QR → cliente paga → finaliza)
  const [pixModal, setPixModal] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixChargeView | null>(null);
  const [pixBusy, setPixBusy] = useState(false);
  const [pixError, setPixError] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [pixTerminal, setPixTerminal] = useState(false); // cobrar na maquininha

  // IA
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Produtos cadastrados na hora (cadastro rápido): entram na lista vendável
  // sem esperar o refresh do servidor, que só chega no fim da venda.
  const [extraProducts, setExtraProducts] = useState<Product[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);

  const allProducts = useMemo(
    () => [...extraProducts, ...products],
    [products, extraProducts],
  );
  const byId = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );
  const categories = useMemo(
    () => [...new Set(allProducts.map((p) => p.category).filter(Boolean))],
    [allProducts],
  );

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return allProducts.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        norm(p.name).includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        norm(p.category).includes(q)
      );
    });
  }, [allProducts, search, category]);

  const lines = Object.entries(cart).map(([id, qty]) => ({
    p: byId.get(id)!,
    qty,
  }));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const discRaw = parseFloat(discInput.replace(",", ".")) || 0;
  const discountValue = Math.min(
    subtotal,
    Math.max(0, discType === "percent" ? (subtotal * discRaw) / 100 : discRaw),
  );
  const total = Math.max(0, subtotal - discountValue);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const hasCash = payments.some((p) => p.method === "dinheiro");
  const troco = hasCash ? Math.max(0, paid - total) : 0;

  // Busca sugestões de IA quando o carrinho muda (debounced).
  const cartKey = Object.keys(cart).sort().join(",");
  useEffect(() => {
    if (!active || lines.length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await suggestCrossSellAction(Object.keys(cart));
      if (!cancelled && res.ok) {
        setSuggestions(res.suggestions.filter((s) => !cart[s.id]));
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, active]);

  /**
   * Atalhos de teclado (operação sem mouse — padrão de PDV profissional).
   *
   *   F2  nova venda / voltar o foco para a busca
   *   F4  desconto            F8  cliente
   *   F9  finalizar a venda   ESC fecha modal ou cancela a venda
   *
   * As teclas de função funcionam mesmo com o cursor dentro de um campo (é o
   * que o operador espera); ESC é contextual e nunca descarta o carrinho sem
   * confirmação.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "F2":
          e.preventDefault();
          if (!active) startSale();
          else searchRef.current?.focus();
          break;
        case "F4":
          if (!active) return;
          e.preventDefault();
          discRef.current?.focus();
          discRef.current?.select();
          break;
        case "F8":
          if (!active) return;
          e.preventDefault();
          if (customer) return; // já identificado
          setShowCustomerForm(true);
          setTimeout(() => customerRef.current?.focus(), 50);
          break;
        case "F9":
          if (!active) return;
          e.preventDefault();
          void finalize();
          break;
        case "Escape": {
          // Contextual: fecha o que estiver aberto antes de mexer na venda.
          if (quickOpen) {
            e.preventDefault();
            setQuickOpen(false);
            return;
          }
          if (pixModal) {
            e.preventDefault();
            // Só fecha o QR se a cobrança ainda não foi paga — cobrança paga
            // precisa concluir a venda, não pode ser descartada por engano.
            if (!pixCharge || pixCharge.status !== "pago") resetPix();
            return;
          }
          if (showCustomerForm) {
            e.preventDefault();
            setShowCustomerForm(false);
            return;
          }
          if (active && lines.length > 0) {
            e.preventDefault();
            if (confirm("Cancelar esta venda? Os itens do carrinho serão perdidos."))
              cancelSale();
          }
          break;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    cart,
    payments,
    discInput,
    customer,
    busy,
    pixModal,
    pixCharge,
    showCustomerForm,
    quickOpen,
  ]);

  /** Cria o produto na hora e já joga no carrinho, sem largar a venda. */
  function onQuickCreated(p: Product) {
    setExtraProducts((prev) => [p, ...prev]);
    setQuickOpen(false);
    setSearch("");
    setCart((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function startSale() {
    setActive(true);
    setCart({});
    setCustomer(null);
    setShowCustomerForm(false);
    setError("");
    setLastSale("");
    setDiscInput("");
    setPayments([]);
    setSearch("");
    setCategory("");
    setSuggestions([]);
    resetPix();
    tokenRef.current = newToken();
    setTimeout(() => searchRef.current?.focus(), 50);
  }
  function cancelSale() {
    // Cancela best-effort uma cobrança PIX ainda pendente desta venda.
    if (pixCharge && pixCharge.status === "pendente")
      void cancelPixChargeAction(pixCharge.id);
    setActive(false);
    setCart({});
    setCustomer(null);
    setPayments([]);
    setDiscInput("");
    setError("");
    resetPix();
  }
  function resetPix() {
    setPixModal(false);
    setPixCharge(null);
    setPixBusy(false);
    setPixError("");
    setPixCopied(false);
    setPixTerminal(false);
  }

  function addToCart(id: string) {
    const p = byId.get(id);
    if (!p) return;
    setError("");
    setCart((prev) => {
      const cur = prev[id] ?? 0;
      if (cur + 1 > p.stock) {
        setError(`Sem estoque de "${p.name}" (${p.stock} disponível).`);
        return prev;
      }
      return { ...prev, [id]: cur + 1 };
    });
  }

  function onSearchEnter() {
    const q = search.trim();
    if (!q) return;
    const exact = products.find((p) => p.barcode && p.barcode === q);
    if (exact) {
      addToCart(exact.id);
      setSearch("");
      return;
    }
    if (filtered.length === 1) {
      addToCart(filtered[0].id);
      setSearch("");
    }
  }

  function changeQty(id: string, delta: number) {
    const p = byId.get(id);
    if (!p) return;
    setCart((prev) => {
      const next = Math.min(p.stock, Math.max(0, (prev[id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }
  function removeItem(id: string) {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function addPayment(method: string) {
    // Atualização funcional: cliques rápidos em sequência veem o estado mais
    // recente (sem isso, dois cliques adicionavam dois pagamentos cheios).
    setPayments((prev) => {
      const paidPrev = prev.reduce((s, p) => s + p.amount, 0);
      const rem = Math.round(Math.max(0, total - paidPrev) * 100) / 100;
      if (rem <= 0) return prev;
      return [...prev, { method, amount: rem }];
    });
  }
  function updatePayment(i: number, amount: number) {
    const copy = [...payments];
    copy[i] = { ...copy[i], amount: Math.max(0, amount) };
    setPayments(copy);
  }
  function removePayment(i: number) {
    setPayments(payments.filter((_, idx) => idx !== i));
  }

  async function saveCustomer() {
    if (savingCustomer) return;
    setSavingCustomer(true);
    const res = await createCustomerAction({
      name: cName,
      phone: cPhone,
      email: cEmail,
    });
    setSavingCustomer(false);
    if (res.ok) {
      setCustomer(res.customer);
      setShowCustomerForm(false);
      setCName("");
      setCPhone("");
      setCEmail("");
    }
  }

  const pixTotal = round2(
    payments.filter((p) => p.method === "pix").reduce((s, p) => s + p.amount, 0),
  );

  async function finalize() {
    if (submitting.current || busy || pixBusy || lines.length === 0) return;
    if (payments.length > 0 && paid + 0.01 < total) {
      setError("Pagamento insuficiente para o total.");
      return;
    }
    // Há parcela PIX e ainda não confirmada → abre a cobrança (QR) e aguarda.
    if (pixTotal > 0 && !(pixCharge && pixCharge.status === "pago")) {
      await openPixCharge(pixTotal);
      return;
    }
    await doFinalize(pixCharge?.id ?? null);
  }

  /** Cria/recupera a cobrança PIX e abre o modal do QR. */
  async function openPixCharge(amount: number) {
    setPixError("");
    setPixBusy(true);
    setPixModal(true);
    const res = await createPixChargeAction({
      token: tokenRef.current,
      amount,
      customerId: customer?.id ?? null,
      terminal: pixHasDevice && pixTerminal,
    });
    setPixBusy(false);
    if (!res.ok) {
      setPixError(res.error);
      return;
    }
    setPixCharge(res.charge);
    if (res.charge.status === "pago") void completePixSale(res.charge);
  }

  /** Pagamento confirmado → fecha o modal e finaliza a venda com o id da cobrança. */
  async function completePixSale(charge: PixChargeView) {
    setPixModal(false);
    await doFinalize(charge.id);
  }

  async function confirmSimulated() {
    if (!pixCharge || pixBusy) return;
    setPixBusy(true);
    const res = await confirmSimulatedPixAction(pixCharge.id);
    setPixBusy(false);
    if (!res.ok) {
      setPixError(res.error);
      return;
    }
    setPixCharge(res.charge);
    if (res.charge.status === "pago") void completePixSale(res.charge);
  }

  async function copyBrCode() {
    if (!pixCharge?.brCode) return;
    try {
      await navigator.clipboard.writeText(pixCharge.brCode);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 1800);
    } catch {
      /* clipboard indisponível — usuário copia manualmente */
    }
  }

  async function cancelPix() {
    if (pixCharge && pixCharge.status === "pendente")
      void cancelPixChargeAction(pixCharge.id);
    resetPix();
  }

  async function doFinalize(pixChargeId: string | null) {
    if (submitting.current || busy) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const token = tokenRef.current;
    try {
      const res = await finalizeSaleAction({
        items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
        token,
        customerId: customer?.id ?? null,
        discount: discountValue,
        payments,
        pixChargeId,
      });
      if (res.ok) {
        setLastSale(
          `Venda finalizada — ${brl(res.total)}${
            customer ? ` · ${customer.name}` : ""
          }${res.change > 0 ? ` · troco ${brl(res.change)}` : ""}.`,
        );
        setLastSaleId(res.saleId);
        setLastSalePhone(customer?.phone ?? "");
        setLastSaleName(customer?.name ?? "");
        setActive(false);
        setCart({});
        setCustomer(null);
        setPayments([]);
        setDiscInput("");
        resetPix();
        tokenRef.current = newToken();
        router.refresh();
      } else {
        setError(res.error);
        resetPix();
      }
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  // Cobrança REAL: faz polling do status até pagar/expirar (o webhook do PSP
  // também marca a cobrança; aqui garantimos a reação no caixa). No modo
  // simulado não há PSP — a confirmação é manual pelo botão.
  const pixId = pixCharge?.id;
  const pixStatus = pixCharge?.status;
  const pixSimulate = pixCharge?.simulate;
  useEffect(() => {
    if (!pixModal || !pixId || pixSimulate || pixStatus !== "pendente") return;
    let stop = false;
    const t = setInterval(async () => {
      const res = await getPixChargeStatusAction(pixId);
      if (stop || !res.ok) return;
      setPixCharge(res.charge);
      if (res.charge.status === "pago") {
        clearInterval(t);
        void completePixSale(res.charge);
      } else if (
        res.charge.status === "expirado" ||
        res.charge.status === "cancelado"
      ) {
        clearInterval(t);
        setPixError(`Cobrança ${res.charge.status}. Refaça o pagamento.`);
      }
    }, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixModal, pixId, pixStatus, pixSimulate]);

  // ---------- TELA OCIOSA ----------
  if (!active) {
    return (
      <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {lastSale && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {lastSale}
            </div>
            {lastSaleId && (
              <div className="flex flex-col items-center gap-2">
                <a
                  href={`/espaco/${slug}/recibo/${lastSaleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir recibo
                </a>
                <ReceiptSender
                  key={lastSaleId}
                  saleId={lastSaleId}
                  defaultPhone={lastSalePhone}
                  defaultName={lastSaleName}
                />
              </div>
            )}
          </div>
        )}
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Caixa livre
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Inicie uma venda para buscar produtos, ler código de barras e
          identificar o cliente.
        </p>
        <button
          type="button"
          onClick={startSale}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Play className="h-4 w-4" />
          Iniciar venda
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Atalho: <kbd className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-ink-800">F2</kbd>
        </p>
      </div>
    );
  }

  // ---------- VENDA EM ANDAMENTO ----------
  return (
    <>
    <div className="grid gap-4 lg:grid-cols-5">
      {/* ESQUERDA: busca + categorias + grade + IA */}
      <div className="space-y-4 lg:col-span-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
            autoFocus
            placeholder="Buscar por nome, categoria ou bipar código de barras…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-100"
           aria-label="Buscar por nome, categoria ou bipar código de barras" />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={category === ""} onClick={() => setCategory("")}>
              Todos
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const out = p.stock === 0;
            const inCart = cart[p.id] ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p.id)}
                disabled={out}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-md disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900"
              >
                {inCart > 0 && (
                  <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-ink-950">
                    {inCart}
                  </span>
                )}
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
                  <Package className="h-5 w-5" />
                </div>
                <span className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {p.name}
                </span>
                <span className="mt-0.5 text-xs text-slate-400">
                  {out ? "sem estoque" : `${p.stock} un.`}
                </span>
                <span className="mt-2 text-base font-bold text-brand-600 dark:text-brand-300">
                  {brl(p.price)}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center">
              <p className="text-sm text-slate-400">Nenhum produto encontrado.</p>
              {canManageProducts && (
                <button
                  type="button"
                  onClick={() => setQuickOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/5 px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
                >
                  <Plus className="h-4 w-4" /> Cadastrar
                  {search.trim() ? ` "${search.trim()}"` : " novo produto"}
                </button>
              )}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-300">
              <Sparkles className="h-4 w-4" />
              Sugestões da IA para esta venda
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addToCart(s.id)}
                  className="group flex items-center gap-2 rounded-xl border border-brand-500/30 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-brand-500 dark:bg-ink-900"
                >
                  <Plus className="h-4 w-4 text-brand-500" />
                  <span>
                    <span className="block font-medium text-slate-800 dark:text-slate-100">
                      {s.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {s.reason} · {brl(s.price)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DIREITA: venda */}
      <div className="space-y-4 lg:col-span-2">
        {/* Cliente */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          {customer ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Cliente
                </p>
                <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {customer.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
                    "sem contato"}
                </p>
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                trocar
              </button>
            </div>
          ) : showCustomerForm ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <UserPlus className="h-4 w-4 text-brand-500" />
                  Cadastrar cliente
                </p>
                <button
                  onClick={() => setShowCustomerForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2">
                <input
                  ref={customerRef}
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="Nome*"
                  aria-label="Nome do cliente"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="Telefone"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                   aria-label="Telefone" />
                  <input
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    inputMode="email"
                    placeholder="E-mail"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                   aria-label="E-mail" />
                </div>
              </div>
              <button
                onClick={saveCustomer}
                disabled={savingCustomer}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
              >
                {savingCustomer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Salvar cliente
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <User className="h-4 w-4" />
                Cliente não identificado
              </span>
              <button
                onClick={() => setShowCustomerForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
          )}
        </div>

        {/* Carrinho + totais + pagamento */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <ShoppingCart className="h-4 w-4 text-brand-500" />
            Venda atual
          </h2>

          <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Toque num produto ou bipe um código.
              </p>
            ) : (
              lines.map((l) => (
                <div
                  key={l.p.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-ink-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                      {l.p.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {brl(l.p.price)} · {brl(l.p.price * l.qty)}
                    </p>
                  </div>
                  <button
                    onClick={() => changeQty(l.p.id, -1)}
                    className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-brand-500 dark:border-ink-600"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {l.qty}
                  </span>
                  <button
                    onClick={() => changeQty(l.p.id, 1)}
                    className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-brand-500 dark:border-ink-600"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeItem(l.p.id)}
                    className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Desconto */}
          <div className="mt-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Desconto
            </span>
            <div className="ml-auto flex items-center gap-1">
              <input
                ref={discRef}
                value={discInput}
                onChange={(e) => setDiscInput(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label="Valor do desconto"
                className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
              <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-ink-600">
                <button
                  onClick={() => setDiscType("value")}
                  className={`px-2 py-1 ${discType === "value" ? "bg-brand-500 text-ink-950" : "text-slate-500"}`}
                >
                  R$
                </button>
                <button
                  onClick={() => setDiscType("percent")}
                  className={`px-2 py-1 ${discType === "percent" ? "bg-brand-500 text-ink-950" : "text-slate-500"}`}
                >
                  %
                </button>
              </div>
            </div>
          </div>

          {/* Totais */}
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-ink-800">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal ({count})</span>
              <span>{brl(subtotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Desconto</span>
                <span>− {brl(discountValue)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Total
              </span>
              <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {brl(total)}
              </span>
            </div>
          </div>

          {/* Pagamento */}
          <div className="mt-3">
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => addPayment(m.key)}
                  className="rounded-lg border border-slate-200 px-1 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                >
                  {m.label}
                </button>
              ))}
            </div>
            {pixHasDevice && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={pixTerminal}
                  onChange={(e) => setPixTerminal(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500"
                />
                <QrCode className="h-3.5 w-3.5" />
                Cobrar PIX na maquininha
              </label>
            )}
            {payments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-16 capitalize text-slate-500">
                      {METHODS.find((m) => m.key === p.method)?.label}
                    </span>
                    <input
                      value={p.amount}
                      aria-label={`Valor pago em `}
                      onChange={(e) =>
                        updatePayment(
                          i,
                          parseFloat(e.target.value.replace(",", ".")) || 0,
                        )
                      }
                      inputMode="decimal"
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                    />
                    <button
                      onClick={() => removePayment(i)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between text-xs">
                  {remaining > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      Falta {brl(remaining)}
                    </span>
                  ) : troco > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Troco {brl(troco)}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Pago
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={finalize}
            disabled={busy || lines.length === 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Finalizar venda · {brl(total)}
            <kbd className="ml-1 rounded bg-ink-950/15 px-1 text-[10px]">F9</kbd>
          </button>
          <button
            type="button"
            onClick={cancelSale}
            className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-slate-500 transition hover:text-red-500"
          >
            Cancelar venda
          </button>

          <ShortcutLegend />
        </div>
      </div>
    </div>

      {/* Modal de cobrança PIX */}
      {quickOpen && (
        <QuickProductModal
          initialName={search.trim()}
          onClose={() => setQuickOpen(false)}
          onCreated={onQuickCreated}
        />
      )}

      {pixModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={cancelPix}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <QrCode className="h-4 w-4 text-brand-500" />
                Pagamento PIX
              </h3>
              <button
                onClick={cancelPix}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pixBusy && !pixCharge ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
              </div>
            ) : pixError ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {pixError}
                </div>
                <button
                  onClick={cancelPix}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-brand-500 dark:border-ink-600 dark:text-slate-300"
                >
                  Fechar
                </button>
              </div>
            ) : pixCharge ? (
              <div className="space-y-3 text-center">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {brl(pixCharge.amount)}
                </p>
                {pixCharge.status === "pago" ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                    Pagamento confirmado
                  </div>
                ) : pixCharge.terminal ? (
                  <>
                    <div className="grid place-items-center gap-2 py-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
                        <QrCode className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Cobrança enviada para a maquininha
                      </p>
                      <p className="px-2 text-xs text-slate-500 dark:text-slate-400">
                        Peça para o cliente escanear o QR PIX na tela do aparelho.
                      </p>
                    </div>
                    <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Aguardando pagamento…
                    </p>
                    {pixCharge.simulate && (
                      <button
                        onClick={confirmSimulated}
                        disabled={pixBusy}
                        className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
                      >
                        {pixBusy ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          "Confirmar pagamento (simulado)"
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {pixCharge.qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pixCharge.qrImage}
                        alt="QR Code PIX"
                        className="mx-auto h-52 w-52 rounded-lg bg-white p-2"
                      />
                    ) : null}
                    <button
                      onClick={copyBrCode}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {pixCopied ? "Copiado!" : "Copiar código PIX"}
                    </button>
                    <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Aguardando pagamento…
                    </p>
                    {pixCharge.simulate && (
                      <button
                        onClick={confirmSimulated}
                        disabled={pixBusy}
                        className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
                      >
                        {pixBusy ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          "Confirmar pagamento (simulado)"
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

/** Envia o recibo da venda por WhatsApp; o telefone informado cadastra o cliente. */
function ReceiptSender({
  saleId,
  defaultPhone,
  defaultName,
}: {
  saleId: string;
  defaultPhone: string;
  defaultName: string;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    null | { ok: boolean; simulated?: boolean; error?: string }
  >(null);

  async function send() {
    if (pending || !phone.trim()) return;
    setPending(true);
    setResult(null);
    const res = await sendSaleReceiptAction({
      saleId,
      phone: phone.trim(),
      name: defaultName,
    });
    setPending(false);
    setResult({ ok: res.ok, simulated: res.simulated, error: res.error });
  }

  if (result?.ok)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <MessageCircle className="h-3.5 w-3.5" />
        Recibo {result.simulated ? "registrado" : "enviado"} no WhatsApp
      </span>
    );

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="WhatsApp do cliente"
          className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
         aria-label="WhatsApp do cliente" />
        <button
          onClick={send}
          disabled={pending || !phone.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar recibo
        </button>
      </div>
      {result?.error ? (
        <span className="text-xs text-red-500">{result.error}</span>
      ) : !defaultPhone ? (
        <span className="text-[11px] text-slate-400">
          Envie o recibo e já cadastre o cliente no estabelecimento.
        </span>
      ) : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand-500 text-ink-950"
          : "border border-slate-200 text-slate-600 hover:border-brand-500 dark:border-ink-600 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Legenda dos atalhos — discreta, mas sempre visível: operador de caixa
 * aprende o teclado olhando, não lendo manual.
 */
function ShortcutLegend() {
  const items: [string, string][] = [
    ["F2", "buscar"],
    ["F4", "desconto"],
    ["F8", "cliente"],
    ["F9", "finalizar"],
    ["ESC", "cancelar"],
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-ink-800">
      {items.map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1">
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-400">
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Cadastro rápido de produto durante a venda. Campos mínimos (nome, preço,
 * estoque inicial, código de barras opcional). Ao salvar, o produto entra na
 * lista vendável e já cai no carrinho — o operador não perde a venda.
 */
function QuickProductModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (p: Product) => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [barcode, setBarcode] = useState("");
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
    const res = await quickCreateProductAction({
      name: name.trim(),
      price: parseFloat(price.replace(",", ".")) || 0,
      stock: parseInt(stock, 10) || 0,
      barcode: barcode.trim(),
    });
    setBusy(false);
    if (res.ok) onCreated(res.product);
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-product-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="quick-product-title"
            className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
          >
            <Package className="h-5 w-5 text-brand-500" /> Novo produto
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Nome*</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Preço (R$)</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Estoque</span>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Código de barras (opcional)
            </span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              inputMode="numeric"
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Cadastrar e adicionar à venda
        </button>
      </div>
    </div>
  );
}
