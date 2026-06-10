import type { NicheOrOther } from "./catalog";

/**
 * Resultado do onboarding: o que a IA (ou o fallback) devolve a partir da
 * descrição em texto livre do negócio.
 */
export interface OnboardingResult {
  niche: NicheOrOther;
  nicheLabel: string;
  /** 0 a 1 — confiança na classificação do nicho. */
  confidence: number;
  /** Dados extraídos da descrição (vazios quando não mencionados). */
  businessName: string;
  city: string;
  state: string;
  country: string;
  /** Sub-segmento livre, ex.: "mercadinho de bairro", "barbearia". */
  segment: string;
  /** Frase curta em pt-BR explicando a classificação. */
  summary: string;
  /** Ids de módulos sugeridos (sempre do catálogo, core + nicho). */
  suggestedModules: string[];
  /** Origem da classificação. */
  source: "ai" | "fallback";
}
