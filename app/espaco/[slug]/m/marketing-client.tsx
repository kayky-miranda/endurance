"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Sparkles, Plus, Palette } from "lucide-react";
import type { PlanDef } from "@/lib/endurance/marketing/plans";
import BrandKitModal from "./brand-kit-modal";
import type { BalanceInfo, Campaign, GenerateResult } from "./marketing/types";
import { BalanceBanner } from "./marketing/balance-banner";
import { NewCampaignModal } from "./marketing/new-campaign-modal";
import { PlansModal } from "./marketing/plans-modal";
import { CampaignPreview } from "./marketing/campaign-preview";
import { CampaignCard } from "./marketing/campaign-card";

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
            campaign={campaigns.find((c) => c.id === selected.id) ?? selected}
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
            Clique em “Novo carrossel” para gerar com IA.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onSelect={() => setSelected(c)} />
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
