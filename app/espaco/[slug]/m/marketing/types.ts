/** Tipos compartilhados pela UI de Marketing (carrosséis com IA). */

export interface BalanceInfo {
  plan: string;
  status: string;
  balance: number;
  unlimited: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  extraCreditCost: number;
}

export interface SlidePreview {
  index: number;
  headline: string;
  layout: string;
  imageUrl: string;
}

export interface Campaign {
  id: string;
  prompt: string;
  status: string;
  errorMsg: string;
  createdAt: string;
  slides: SlidePreview[];
}

export interface GenerateResult {
  campaignId: string;
  status: string;
  slides: {
    index: number;
    layout: string;
    headline: string;
    body: string;
    tag: string;
    bullets?: { icon: string; label: string; desc: string }[];
    steps?: { num: string; title: string; desc: string }[];
    ctaText?: string;
  }[];
  brand: { primaryColor: string; fontHeading: string; logoText: string };
}
