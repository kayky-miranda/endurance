/**
 * Catálogo de PLANOS e regras de ASSINATURA do ENDURANCE.
 *
 * Fonte da verdade única dos planos (espelha os tiers da landing, agora em dado
 * estruturado): a tela de cobrança, os server actions e o gating de assentos
 * leem daqui. Adicionar/ajustar um plano = uma entrada em PLAN_CATALOG.
 *
 * No protótipo a cobrança é auto-gerida (sem provedor externo): a troca de plano
 * é imediata e registra uma fatura interna. O vocabulário segue provedores reais
 * (trialing/active/past_due/canceled) para facilitar uma integração futura.
 */

export type PlanId = "starter" | "professional" | "business" | "enterprise";
export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Preço mensal em BRL. `null` = sob consulta (Enterprise). */
  priceMonthly: number | null;
  /** Limite de usuários do plano (0 = ilimitado). */
  seats: number;
  description: string;
  features: string[];
  /** Plano em destaque na comparação (o "recomendado"). */
  featured: boolean;
  /** Planos sob consulta não são auto-contratáveis (fale com vendas). */
  contactSales: boolean;
}

/** Catálogo de planos. A ordem define a ordem de exibição na interface. */
export const PLAN_CATALOG: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 0,
    seats: 2,
    description: "Para começar a organizar a operação.",
    featured: false,
    contactSales: false,
    features: [
      "Até 2 usuários",
      "Dashboard e financeiro básico",
      "Vendas e estoque",
      "Relatórios essenciais",
      "Suporte por e-mail",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    priceMonthly: 149,
    seats: 10,
    description: "Para equipes que querem crescer com controle.",
    featured: true,
    contactSales: false,
    features: [
      "Até 10 usuários",
      "Todos os módulos operacionais",
      "Assistente e insights de IA",
      "Fiscal (NF-e / NFC-e)",
      "Integrações (WhatsApp, Excel)",
      "Suporte prioritário",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 349,
    seats: 30,
    description: "Para empresas com operação intensa.",
    featured: false,
    contactSales: false,
    features: [
      "Até 30 usuários",
      "IA avançada e previsões",
      "Produção e logística",
      "Power BI e APIs externas",
      "Permissões avançadas",
      "Gerente de conta",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    seats: 0,
    description: "Para grandes operações e múltiplas filiais.",
    featured: false,
    contactSales: true,
    features: [
      "Usuários ilimitados",
      "Multi-filial e multiempresa",
      "SLA e segurança dedicados",
      "Integrações personalizadas",
      "Implantação assistida",
      "Suporte 24/7",
    ],
  },
];

/** Visão de uma fatura para as telas (datas em ISO, valor em number). */
export interface InvoiceView {
  id: string;
  number: string;
  plan: PlanId;
  amount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
}

/** Visão da assinatura para as telas (datas em ISO). */
export interface BillingView {
  plan: PlanId;
  status: SubStatus;
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  /** A assinatura ainda não foi materializada no banco (default virtual). */
  virtual: boolean;
}

const PLAN_BY_ID = new Map(PLAN_CATALOG.map((p) => [p.id, p]));

export function planById(id: string): PlanDef | undefined {
  return PLAN_BY_ID.get(id as PlanId);
}

/** Garante um PlanId válido (fallback no Starter para dados inesperados). */
export function asPlanId(id: string): PlanId {
  return PLAN_BY_ID.has(id as PlanId) ? (id as PlanId) : "starter";
}

export function planLabel(id: string): string {
  return planById(id)?.name ?? id;
}

/** Planos pagos (geram fatura na contratação). */
export function isPaidPlan(id: string): boolean {
  const p = planById(id);
  return Boolean(p && p.priceMonthly != null && p.priceMonthly > 0);
}

/** Ciclo padrão da assinatura no protótipo: 30 dias. */
export const PERIOD_DAYS = 30;

export function nextPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + PERIOD_DAYS);
  return end;
}

const STATUS_LABEL: Record<SubStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as SubStatus] ?? status;
}

/** Formata um valor mensal de plano em BRL (ou "Sob consulta"). */
export function formatPlanPrice(priceMonthly: number | null): string {
  if (priceMonthly == null) return "Sob consulta";
  if (priceMonthly === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(priceMonthly);
}

/** Rótulo de limite de assentos (0 → "ilimitado"). */
export function seatsLabel(seats: number): string {
  return seats > 0 ? String(seats) : "ilimitado";
}
