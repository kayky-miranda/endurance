export type PlanId = "trial" | "basico" | "pro" | "enterprise";

export interface PlanDef {
  id: PlanId;
  label: string;
  priceMonthly: number; // R$
  creditsPerMonth: number; // -1 = ilimitado
  extraCreditCost: number; // R$ por crédito extra; 0 = sem extras
  trialDays: number;
  description: string;
  features: string[];
}

export const PLANS: PlanDef[] = [
  {
    id: "trial",
    label: "Teste gratuito",
    priceMonthly: 0,
    creditsPerMonth: 8,
    extraCreditCost: 0,
    trialDays: 7,
    description: "7 dias para experimentar sem cartão.",
    features: [
      "8 carrosséis no período de teste",
      "Exportação em PNG 1080×1350px",
      "IA (Claude ou Gemini)",
    ],
  },
  {
    id: "basico",
    label: "Básico",
    priceMonthly: 39.9,
    creditsPerMonth: 1,
    extraCreditCost: 20,
    trialDays: 0,
    description: "Para quem publica no Instagram de vez em quando.",
    features: [
      "1 carrossel por mês",
      "Créditos extras por R$ 20 cada",
      "Exportação em PNG 1080×1350px",
      "IA (Claude ou Gemini)",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    priceMonthly: 149,
    creditsPerMonth: 8,
    extraCreditCost: 15,
    trialDays: 0,
    description: "Para quem tem presença ativa nas redes.",
    features: [
      "8 carrosséis por mês",
      "Créditos extras por R$ 15 cada",
      "Exportação em PNG 1080×1350px",
      "IA (Claude ou Gemini)",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    priceMonthly: 399,
    creditsPerMonth: -1,
    extraCreditCost: 0,
    trialDays: 0,
    description: "Uso ilimitado para agências e grandes times.",
    features: [
      "Carrosséis ilimitados",
      "Exportação em PNG 1080×1350px",
      "IA (Claude ou Gemini)",
      "Suporte prioritário",
    ],
  },
];

export const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

export function planById(id: string): PlanDef | undefined {
  return PLAN_BY_ID.get(id as PlanId);
}
