"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Sparkles,
  Plus,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import type { PlanDef } from "@/lib/endurance/marketing/plans";
import BrandKitModal from "./brand-kit-modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BalanceInfo {
  plan: string;
  status: string;
  balance: number;
  unlimited: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  extraCreditCost: number;
}

interface SlidePreview {
  index: number;
  headline: string;
  layout: string;
  imageUrl: string;
}

interface Campaign {
  id: string;
  prompt: string;
  status: string;
  errorMsg: string;
  createdAt: string;
  slides: SlidePreview[];
}

interface GenerateResult {
  campaignId: string;
  status: string;
  slides: { index: number; layout: string; headline: string; body: string; tag: string; bullets?: { icon: string; label: string; desc: string }[]; steps?: { num: string; title: string; desc: string }[]; ctaText?: string }[];
  brand: { primaryColor: string; fontHeading: string; logoText: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EXAMPLES = [
  "Promoção de fim de semana com 20% de desconto em todos os produtos",
  "Lançamento do nosso novo serviço de entrega em domicílio",
  "Dicas para os clientes aproveitarem melhor nossos produtos",
];

// ---------------------------------------------------------------------------
// BalanceBanner
// ---------------------------------------------------------------------------
function BalanceBanner({
  info,
  onPlans,
}: {
  info: BalanceInfo;
  onPlans: () => void;
}) {
  const isTrialEnded = info.status === "trial_ended";
  const isTrial = info.plan === "trial";
  const daysLeft = info.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(info.trialEndsAt).getTime() - Date.now()) / 86400_000,
        ),
      )
    : 0;

  const planLabels: Record<string, string> = {
    trial: "Teste gratuito",
    basico: "Básico",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  if (isTrialEnded) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Teste encerrado
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              Assine um plano para continuar criando carrosséis.
            </p>
          </div>
        </div>
        <button
          onClick={onPlans}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Ver planos
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-4 text-white shadow">
      <div>
        <p className="text-sm font-semibold">
          {planLabels[info.plan] ?? info.plan}
          {isTrial && daysLeft > 0 && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {daysLeft}d restantes
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-white/80">
          {info.unlimited
            ? "Carrosséis ilimitados"
            : `${info.balance} crédito${info.balance !== 1 ? "s" : ""} disponível${info.balance !== 1 ? "s" : ""}`}
        </p>
      </div>
      <button
        onClick={onPlans}
        className="rounded-xl bg-white/20 px-4 py-2 text-xs font-semibold hover:bg-white/30"
      >
        <CreditCard className="mr-1.5 inline h-3.5 w-3.5" />
        Planos
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewCampaignModal
// ---------------------------------------------------------------------------
function NewCampaignModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (result: GenerateResult) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar.");
        return;
      }
      onGenerated(data as GenerateResult);
      onClose();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo carrossel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Descreva o tema do carrossel. A IA criará 7 slides profissionais.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex.: Promoção de final de semana com 30% off em todos os produtos do açougue..."
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-800 dark:text-slate-300"
            >
              {ex.slice(0, 40)}…
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Gerando…" : "Gerar (1 crédito)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlansModal
// ---------------------------------------------------------------------------
function PlansModal({
  plans,
  current,
  onClose,
  onChanged,
}: {
  plans: PlanDef[];
  current: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function select(planId: string) {
    setLoading(planId);
    await fetch("/api/marketing/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_plan", planId }),
    });
    setLoading(null);
    onChanged();
    onClose();
  }

  const paid = plans.filter((p) => p.id !== "trial");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Planos de Marketing</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {paid.map((p) => {
            const isCurrent = p.id === current;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 ${isCurrent ? "border-brand-500 bg-brand-500/5" : "border-slate-200 dark:border-ink-700"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                  {p.label}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {brl(p.priceMonthly)}
                  <span className="text-sm font-normal text-slate-400">/mês</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => select(p.id)}
                  disabled={isCurrent || loading === p.id}
                  className={`mt-4 w-full rounded-xl py-2 text-sm font-semibold transition ${
                    isCurrent
                      ? "bg-brand-500 text-white opacity-60"
                      : "bg-brand-500 text-white hover:bg-brand-600"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {loading === p.id ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : (
                    "Assinar"
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Pagamento simulado — sem cobrança real no protótipo.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlideTextPreview (fallback enquanto imagens renderizam)
// ---------------------------------------------------------------------------
function SlideTextPreview({
  slide,
}: {
  slide: { headline: string; layout: string; index: number };
}) {
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-center text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
          Slide {slide.index + 1} · {slide.layout}
        </p>
        <p className="mt-3 text-lg font-bold leading-snug">{slide.headline}</p>
        <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin opacity-60" />
        <p className="mt-2 text-xs opacity-60">Renderizando…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignPreview
// ---------------------------------------------------------------------------
function CampaignPreview({ campaign }: { campaign: Campaign }) {
  const [cur, setCur] = useState(0);
  const slides = campaign.slides;
  const slide = slides[cur];

  async function downloadSlide(url: string, index: number) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slide_${index + 1}.png`;
    a.click();
  }

  async function copyCaption() {
    const text = slides.map((s) => s.headline).join("\n");
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="mb-3 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {campaign.prompt}
      </p>

      {/* Slide principal */}
      <div className="relative">
        {slide?.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={`Slide ${cur + 1}`}
            className="aspect-[4/5] w-full rounded-xl object-cover"
          />
        ) : (
          <SlideTextPreview slide={slide ?? { headline: "", layout: "", index: cur }} />
        )}
        {/* Navegação */}
        <button
          onClick={() => setCur((c) => Math.max(0, c - 1))}
          disabled={cur === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setCur((c) => Math.min(slides.length - 1, c + 1))}
          disabled={cur === slides.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white disabled:opacity-20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCur(i)}
            className={`relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition ${
              i === cur ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {s.imageUrl ? (
              <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-500/20">
                <ImageIcon className="h-4 w-4 text-brand-500" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Ações */}
      <div className="mt-3 flex gap-2">
        {slide?.imageUrl && (
          <button
            onClick={() => downloadSlide(slide.imageUrl, cur)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Download className="h-4 w-4" />
            Baixar slide {cur + 1}
          </button>
        )}
        <button
          onClick={copyCaption}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-ink-700 dark:hover:bg-ink-800"
        >
          <Copy className="h-4 w-4" />
          Copiar legenda
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignCard (lista)
// ---------------------------------------------------------------------------
function CampaignCard({
  c,
  onSelect,
}: {
  c: Campaign;
  onSelect: () => void;
}) {
  const thumb = c.slides.find((s) => s.imageUrl)?.imageUrl;
  const statusColor =
    c.status === "ready"
      ? "bg-green-100 text-green-700"
      : c.status === "error"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  const statusLabel =
    c.status === "ready" ? "Pronto" : c.status === "error" ? "Erro" : "Renderizando";

  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="aspect-[4/5] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-brand-500/10">
          {c.status === "rendering" ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          ) : (
            <ImageIcon className="h-6 w-6 text-brand-400" />
          )}
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200">
        {c.prompt}
      </p>
      <span
        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}
      >
        {statusLabel}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function MarketingClient() {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBalance = useCallback(async () => {
    const res = await fetch("/api/marketing/credits");
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
      setPlans(data.plans ?? []);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/marketing/campaigns");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadCampaigns();
  }, [loadBalance, loadCampaigns]);

  // Polling enquanto há campanhas renderizando
  useEffect(() => {
    const rendering = campaigns.some((c) => c.status === "rendering");
    if (rendering && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        await loadCampaigns();
        // Atualiza campanha selecionada também
        if (selected && selected.status === "rendering") {
          const res = await fetch(`/api/marketing/campaigns/${selected.id}`);
          if (res.ok) {
            const data = await res.json();
            setSelected(data.campaign);
          }
        }
      }, 2500);
    } else if (!rendering && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [campaigns, selected, loadCampaigns]);

  function handleGenerated(result: GenerateResult) {
    // Cria uma campanha provisória no estado (slides sem imageUrl ainda)
    const provisional: Campaign = {
      id: result.campaignId,
      prompt: "",
      status: "rendering",
      errorMsg: "",
      createdAt: new Date().toISOString(),
      slides: result.slides.map((s) => ({
        index: s.index,
        layout: s.layout,
        headline: s.headline,
        imageUrl: "",
      })),
    };
    setCampaigns((prev) => [provisional, ...prev]);
    setSelected(provisional);
    loadBalance();
  }

  return (
    <div className="space-y-5">
      {balance && (
        <BalanceBanner info={balance} onPlans={() => setShowPlans(true)} />
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Campanhas
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrand(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-300"
          >
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Identidade</span>
          </button>
          <button
            onClick={() => setShowNew(true)}
            disabled={balance?.status === "trial_ended"}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Novo carrossel
          </button>
        </div>
      </div>

      {/* Selecionado */}
      {selected && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Visualizando
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Fechar
            </button>
          </div>
          <CampaignPreview
            campaign={
              campaigns.find((c) => c.id === selected.id) ?? selected
            }
          />
        </div>
      )}

      {/* Grid de campanhas */}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <Sparkles className="mx-auto h-8 w-8 text-brand-400" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">
            Nenhum carrossel criado ainda
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Clique em "Novo carrossel" para gerar com IA.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              onSelect={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewCampaignModal
          onClose={() => setShowNew(false)}
          onGenerated={handleGenerated}
        />
      )}
      {showPlans && (
        <PlansModal
          plans={plans}
          current={balance?.plan ?? "trial"}
          onClose={() => setShowPlans(false)}
          onChanged={loadBalance}
        />
      )}
      {showBrand && <BrandKitModal onClose={() => setShowBrand(false)} />}
    </div>
  );
}
