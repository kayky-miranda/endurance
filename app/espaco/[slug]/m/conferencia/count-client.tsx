"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Search,
  ScanBarcode,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  XCircle,
  AlertCircle,
  PackageSearch,
  Target,
  Volume2,
  VolumeX,
  Camera,
  EyeOff,
  Download,
  Printer,
} from "lucide-react";
import { CameraScanner } from "./camera-scanner";
import {
  searchProductsAction,
  addItemAction,
  scanCountAction,
  removeItemAction,
  setCountedAction,
  finalizeCountAction,
  approveCountAction,
  reopenCountAction,
  adjustCountAction,
  cancelCountAction,
} from "./count-actions";
import { CountStatusBadge, CountTypeBadge } from "./badges";
import type { CountDetail } from "@/lib/endurance/stock-count";
import type { ScannedItem } from "@/lib/endurance/stock-count";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Item = CountDetail["items"][number];

/** Beep curto por WebAudio (agudo = ok, grave = erro). Sem asset externo. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  return (ok: boolean) => {
    try {
      if (!ctxRef.current)
        ctxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = ok ? "sine" : "square";
      osc.frequency.value = ok ? 880 : 200;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.25));
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    } catch {
      /* áudio bloqueado — o feedback visual cobre */
    }
  };
}

export default function CountClient({
  slug,
  count,
  canApprove,
}: {
  slug: string;
  count: CountDetail;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // Itens em estado LOCAL (fonte da verdade da tela) — semeados do servidor e
  // atualizados por scan/busca/edição sem recarregar a página.
  const [items, setItems] = useState<Item[]>(count.items);
  const [lastScanId, setLastScanId] = useState<string | null>(null);

  // Sincronização multiusuário: o servidor é a fonte da verdade. Quando um
  // refresh traz novos dados (outro operador bipou/finalizou), realinha o
  // estado local — os bipes deste operador já foram gravados antes do upsert
  // local, então nada se perde.
  useEffect(() => {
    setItems(count.items);
  }, [count.items]);

  // Enquanto a conferência está ativa, revalida a cada 15s e ao voltar o foco
  // para a aba — assim status e contagens de outros operadores aparecem sem
  // recarregar a página.
  const active = count.status !== "ajustada" && count.status !== "cancelada";
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => router.refresh(), 15000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, router]);

  const editable = count.status === "rascunho" || count.status === "em_conferencia";
  const awaiting = count.status === "aguardando_aprovacao";
  const approved = count.status === "aprovada";
  // Conferência CEGA: enquanto está em contagem, ninguém vê saldo do sistema
  // nem divergência na tela (anti-viés). Tudo aparece a partir da aprovação.
  const hideSystem = count.blind && editable;

  function upsert(it: ScannedItem) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === it.id);
      if (idx === -1) return [...prev, it];
      const next = [...prev];
      next[idx] = it;
      return next;
    });
  }

  // Totais ao vivo (a partir do estado local).
  const countedItems = items.filter((it) => it.countedQty != null);
  const divergentItems = countedItems.filter(
    (it) => (it.countedQty as number) !== it.systemQty,
  );
  const divValue = divergentItems.reduce(
    (s, it) => s + Math.abs((it.countedQty as number) - it.systemQty) * it.unitCost,
    0,
  );
  const accuracy =
    countedItems.length > 0
      ? ((countedItems.length - divergentItems.length) / countedItems.length) * 100
      : 100;

  function commitCount(it: Item, raw: string) {
    const parsed = raw.trim() === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
    // otimista
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? { ...x, countedQty: parsed, divergence: parsed == null ? null : parsed - x.systemQty }
          : x,
      ),
    );
    startTransition(async () => {
      const res = await setCountedAction(count.id, it.id, parsed);
      if (!res.ok) setMsg({ tone: "err", text: res.error ?? "Falha ao salvar." });
    });
  }

  function runStatus(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg({ tone: "ok", text: okText });
        router.refresh();
      } else setMsg({ tone: "err", text: res.error ?? "Não foi possível concluir." });
    });
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <Link
          href={`/espaco/${slug}/m/conferencia`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Conferências
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{count.number}</h1>
          <CountTypeBadge type={count.type} />
          <CountStatusBadge status={count.status} />
          {count.blind && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-300">
              <EyeOff className="h-3 w-3" /> Cega
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <a
              href={`/espaco/${slug}/m/conferencia/${count.id}/export`}
              download
              title="Exportar CSV"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-400"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
            <Link
              href={`/espaco/${slug}/m/conferencia/${count.id}/imprimir`}
              title="Imprimir"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-400"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Link>
          </span>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {count.locationName && (
            <span className="font-medium text-slate-600 dark:text-slate-300">
              🏬 {count.locationName}
            </span>
          )}
          {count.location && <span>📍 {count.location}</span>}
          <span>Responsável: {count.responsibleName || "—"}</span>
          <span>Criada por {count.createdByName}</span>
          {count.approvedByName && <span>Aprovada por {count.approvedByName}</span>}
        </p>
      </div>

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

      {/* Resumo ao vivo (na conferência cega, divergências só após a contagem) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Itens" value={`${countedItems.length}/${items.length}`} />
        {!hideSystem && (
          <>
            <MiniStat
              label="Divergências"
              value={String(divergentItems.length)}
              tone={divergentItems.length ? "rose" : "slate"}
            />
            <MiniStat label="Valor divergência" value={brl(divValue)} tone="amber" />
            <MiniStat
              label="Acuracidade"
              value={`${accuracy.toFixed(1)}%`}
              tone="emerald"
              icon={<Target className="h-3.5 w-3.5" />}
            />
          </>
        )}
        {hideSystem && (
          <div className="col-span-2 flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-violet-600 sm:col-span-3 dark:text-violet-300">
            <EyeOff className="h-4 w-4 shrink-0" />
            Conferência cega: o saldo do sistema e as divergências ficam ocultos
            até a contagem ser finalizada.
          </div>
        )}
      </div>

      {/* Ações de estado */}
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <button
            onClick={() => runStatus(() => finalizeCountAction(count.id), "Conferência enviada para aprovação.")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-40"
          >
            <ShieldCheck className="h-4 w-4" /> Finalizar para aprovação
          </button>
        )}
        {awaiting && canApprove && (
          <>
            <button
              onClick={() => runStatus(() => approveCountAction(count.id), "Divergências aprovadas.")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" /> Aprovar divergências
            </button>
            <button
              onClick={() => runStatus(() => reopenCountAction(count.id), "Devolvida para recontagem.")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-ink-600 dark:text-slate-200 dark:hover:bg-ink-800"
            >
              <RotateCcw className="h-4 w-4" /> Devolver p/ recontagem
            </button>
          </>
        )}
        {awaiting && !canApprove && (
          <p className="rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-300">
            Aguardando aprovação de um gestor para efetivar o ajuste.
          </p>
        )}
        {approved && canApprove && (
          <button
            onClick={() => runStatus(() => adjustCountAction(count.id), "Estoque ajustado com sucesso.")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            <PackageSearch className="h-4 w-4" /> Efetivar ajuste no estoque
          </button>
        )}
        {count.status !== "ajustada" && count.status !== "cancelada" && (
          <button
            onClick={() => {
              if (confirm("Cancelar esta conferência? Nenhum ajuste será feito."))
                runStatus(() => cancelCountAction(count.id), "Conferência cancelada.");
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-rose-500/50 hover:text-rose-500 disabled:opacity-40 dark:border-ink-600"
          >
            <XCircle className="h-4 w-4" /> Cancelar
          </button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Leitura / adição (só durante a contagem) */}
      {editable && (
        <ScanBar
          countId={count.id}
          onScan={(it) => {
            upsert(it);
            setLastScanId(it.id);
          }}
          onAdd={(it) => upsert(it)}
          setMsg={setMsg}
        />
      )}

      {/* Tabela de itens */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {items.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <PackageSearch className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhum produto na conferência
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Bipe um código no scanner ou use a busca acima para adicionar itens.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  {!hideSystem && (
                    <th className="px-4 py-2.5 font-medium text-center">Sistema</th>
                  )}
                  <th className="px-4 py-2.5 font-medium text-center">Físico</th>
                  {!hideSystem && (
                    <th className="px-4 py-2.5 font-medium text-center">Divergência</th>
                  )}
                  {editable && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {/* Itens recém-bipados sobem para o topo, na ordem inversa de leitura */}
                {items.map((it) => {
                  const c = it.countedQty;
                  const div = c == null ? null : c - it.systemQty;
                  const hasDiv = !hideSystem && div != null && div !== 0;
                  const flash = it.id === lastScanId;
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-slate-100 transition-colors last:border-0 dark:border-ink-800 ${
                        flash
                          ? "bg-emerald-500/10"
                          : hasDiv
                            ? "bg-rose-500/[0.04]"
                            : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {it.productName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {[it.barcode, it.category].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      {!hideSystem && (
                        <td className="px-4 py-3 text-center font-medium text-slate-500 dark:text-slate-400">
                          {it.systemQty}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={c ?? ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        countedQty:
                                          e.target.value === ""
                                            ? null
                                            : Math.max(0, parseInt(e.target.value, 10) || 0),
                                      }
                                    : x,
                                ),
                              )
                            }
                            onBlur={(e) => commitCount(it, e.target.value)}
                            placeholder="—"
                            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {c ?? "—"}
                          </span>
                        )}
                      </td>
                      {!hideSystem && (
                      <td className="px-4 py-3 text-center">
                        {div == null ? (
                          <span className="text-slate-300">—</span>
                        ) : div === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" /> OK
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              div > 0
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                            }`}
                          >
                            {div > 0 ? "+" : ""}
                            {div}
                          </span>
                        )}
                      </td>
                      )}
                      {editable && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              startTransition(async () => {
                                const res = await removeItemAction(count.id, it.id);
                                if (res.ok) setItems((prev) => prev.filter((x) => x.id !== it.id));
                              })
                            }
                            className="inline-grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-500 dark:border-ink-600"
                            aria-label="Remover item"
                            title="Remover da conferência"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
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

function MiniStat({
  label,
  value,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string;
  tone?: "slate" | "rose" | "amber" | "emerald";
  icon?: React.ReactNode;
}) {
  const toneCls: Record<string, string> = {
    slate: "text-slate-800 dark:text-slate-100",
    rose: "text-rose-600 dark:text-rose-300",
    amber: "text-amber-600 dark:text-amber-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${toneCls[tone]}`}>{value}</p>
    </div>
  );
}

function ScanBar({
  countId,
  onScan,
  onAdd,
  setMsg,
}: {
  countId: string;
  onScan: (it: ScannedItem) => void;
  onAdd: (it: ScannedItem) => void;
  setMsg: (m: { tone: "ok" | "err"; text: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; barcode: string; sku: string; stock: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement | null>(null);
  const [, startTransition] = useTransition();
  const beep = useBeep();

  // Foco no campo de leitura ao abrir a tela (modo hands-free).
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  function feedback(ok: boolean) {
    if (soundOn) beep(ok);
    setFlash(ok ? "ok" : "err");
    setTimeout(() => setFlash(null), ok ? 350 : 600);
  }

  function refocus() {
    if (scanRef.current) {
      scanRef.current.value = "";
      scanRef.current.focus();
    }
  }

  function scan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = (e.target as HTMLInputElement).value.trim();
    if (!code) return;
    startTransition(async () => {
      const res = await scanCountAction(countId, code);
      if (res.ok) {
        onScan(res.item);
        feedback(true);
        setMsg({
          tone: "ok",
          text: `${res.item.productName} — contado: ${res.item.countedQty}`,
        });
      } else {
        feedback(false);
        setMsg({ tone: "err", text: res.error });
      }
      refocus(); // mantém o foco para a próxima leitura, sempre
    });
  }

  async function search(term: string) {
    setQ(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const res = await searchProductsAction(term);
    setSearching(false);
    if (res.ok) setResults(res.products ?? []);
  }

  function add(productId: string) {
    startTransition(async () => {
      const res = await addItemAction(countId, productId);
      if (res.ok && res.item) {
        onAdd(res.item);
        setQ("");
        setResults([]);
      } else setMsg({ tone: "err", text: res.error ?? "Falha ao adicionar." });
    });
  }

  // Leitura pela câmera: mesmo fluxo do scanner físico (incrementa +1), mas o
  // beep/feedback é tratado dentro do overlay. Devolve o texto a exibir lá.
  async function detectFromCamera(code: string): Promise<{ ok: boolean; text: string }> {
    const res = await scanCountAction(countId, code);
    if (res.ok) {
      onScan(res.item);
      const t = `${res.item.productName} — contado: ${res.item.countedQty}`;
      setMsg({ tone: "ok", text: t });
      return { ok: true, text: t };
    }
    setMsg({ tone: "err", text: res.error });
    return { ok: false, text: res.error };
  }

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors dark:bg-ink-900 ${
        flash === "ok"
          ? "border-emerald-500/60 ring-2 ring-emerald-500/30"
          : flash === "err"
            ? "border-rose-500/60 ring-2 ring-rose-500/30"
            : "border-slate-200 dark:border-ink-700"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Leitura por scanner — destaque, foco automático */}
        <div className="relative sm:order-2">
          <ScanBarcode
            className={`pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${
              flash === "err" ? "text-rose-500" : "text-brand-500"
            }`}
          />
          <input
            ref={scanRef}
            onKeyDown={scan}
            autoFocus
            placeholder="Bipe o código de barras aqui…"
            className="w-full rounded-xl border-2 border-brand-500/40 bg-brand-500/5 py-3 pl-10 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:bg-brand-500/10 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            title={soundOn ? "Som ligado" : "Som desligado"}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-brand-500"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        {/* Busca manual por código/SKU/descrição */}
        <div className="relative sm:order-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Buscar por código, SKU, descrição…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
          />
          {(results.length > 0 || searching) && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
              {searching && <p className="px-3 py-2 text-xs text-slate-400">Buscando…</p>}
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-ink-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700 dark:text-slate-200">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {[p.barcode, p.sku].filter(Boolean).join(" · ") || "sem código"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">saldo {p.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 pl-1 text-xs text-slate-400">
          <Plus className="h-3 w-3" /> Modo hands-free: bipe os produtos em sequência —
          cada leitura soma +1 na contagem e mantém o foco para a próxima.
        </p>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/5 px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
        >
          <Camera className="h-4 w-4" /> Ler pela câmera
        </button>
      </div>

      {cameraOpen && (
        <CameraScanner
          onDetect={detectFromCamera}
          onClose={() => {
            setCameraOpen(false);
            refocus();
          }}
          playBeep={(ok) => {
            if (soundOn) beep(ok);
          }}
        />
      )}
    </div>
  );
}
