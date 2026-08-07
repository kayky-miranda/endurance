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

/**
 * CAPACIDADES COBRÁVEIS — o que o plano libera além dos assentos.
 *
 * Só entra aqui o que separa planos de verdade. A operação do ramo (agenda,
 * prontuário, PDV, fiscal, documentos, relatórios) fica FORA de propósito: é o
 * motivo de o cliente abrir o sistema todo dia, e restringir isso gera
 * cancelamento em vez de upgrade. O que separa planos é o que só passa a
 * importar quando a empresa cresce — equipe, integração, filial, holding.
 *
 * A IA também não está aqui: ela é medida por CRÉDITO, não bloqueada por plano.
 * Esconder o principal diferencial no topo faria a maioria dos clientes nunca
 * experimentar aquilo que justificaria pagar mais.
 */
export const PLAN_FEATURES = [
  "audit.log",
  "api.access",
  "multi.location",
  "purchasing.workflow",
  "data.export",
  "multi.company",
  "white.label",
  "priority.processing",
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];

export interface PlanFeatureDef {
  id: PlanFeature;
  label: string;
  /** Frase curta mostrada na tela de bloqueio — diz o ganho, não o recurso. */
  pitch: string;
}

export const PLAN_FEATURE_CATALOG: Record<PlanFeature, PlanFeatureDef> = {
  "audit.log": {
    id: "audit.log",
    label: "Auditoria",
    pitch: "Acompanhe quem alterou o quê, e quando.",
  },
  "api.access": {
    id: "api.access",
    label: "API e integrações",
    pitch: "Conecte o ENDURANCE aos outros sistemas que você usa.",
  },
  "multi.location": {
    id: "multi.location",
    label: "Multi-local",
    pitch: "Controle estoque e transferências entre unidades.",
  },
  "purchasing.workflow": {
    id: "purchasing.workflow",
    label: "Fluxo de compras",
    pitch: "Solicitação, aprovação e cotação com alçada definida.",
  },
  "data.export": {
    id: "data.export",
    label: "Exportações",
    pitch: "Leve seus dados para planilha e ferramentas de BI.",
  },
  "multi.company": {
    id: "multi.company",
    label: "Multiempresa",
    pitch: "Administre várias empresas com visão consolidada.",
  },
  "white.label": {
    id: "white.label",
    label: "Marca própria",
    pitch: "Portal e mensagens ao cliente sem nenhuma marca do ENDURANCE.",
  },
  "priority.processing": {
    id: "priority.processing",
    label: "Processamento prioritário",
    // Dizia "sua fila de IA e relatórios na frente" — e não existe fila
    // nenhuma: as chamadas vão direto ao provedor. A frase agora descreve o que
    // o sistema realmente faz (ver ai-throttle.ts).
    pitch: "Limites de uso mais altos nas análises e na geração com IA.",
  },
};

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
  /**
   * Capacidades que ESTE nível acrescenta. A liberação é CUMULATIVA
   * (`planAllows` percorre a hierarquia), então não se repete o que o plano
   * anterior já dá — evita listas divergirem quando um recurso muda de nível.
   */
  adds: PlanFeature[];
  /** Créditos de IA incluídos por ciclo. 0 = sem IA; -1 = sem teto. */
  aiCredits: number;
  /** Valor por usuário adicional, em BRL. `null` = não vende avulso. */
  extraSeatPrice: number | null;
}

/**
 * Ordem de poder dos planos. É o que torna a liberação cumulativa: quem está no
 * Business tem tudo que o Professional libera, sem precisar duplicar a lista.
 */
export const PLAN_ORDER: PlanId[] = [
  "starter",
  "professional",
  "business",
  "enterprise",
];

/** Duração do teste. `createWorkspace` usa a mesma constante. */
export const TRIAL_DAYS = 14;

/** Plano que o teste entrega por inteiro — ver `TRIAL_CARD`. */
export const TRIAL_PLAN: PlanId = "professional";

/** Planos pagos, na ordem de exibição. O card do teste é derivado abaixo. */
const PAID_PLANS: PlanDef[] = [
  {
    id: "professional",
    name: "Professional",
    priceMonthly: 149,
    seats: 3,
    description: "Para o profissional autônomo e o consultório pequeno.",
    featured: true,
    contactSales: false,
    // EXPORTAÇÃO desce para cá: exportar os próprios dados atrás de um plano
    // 2,3x mais caro é a barreira que mais gera ressentimento, e o dado é do
    // cliente. O gancho comercial real é automação (API, exportação agendada),
    // que continua no Business.
    //
    // PERMISSÕES saíram da lista de capacidades cobráveis (ver PLAN_FEATURES):
    // vender assento sem vender o controle do que o assento faz significa que a
    // recepcionista enxerga faturamento, prontuário e CPF de todo mundo. É o
    // mínimo para operar com mais de uma pessoa, e com dado clínico é questão
    // de LGPD — virou parte do produto, não degrau de plano.
    adds: ["data.export"],
    aiCredits: 150,
    extraSeatPrice: 45,
    features: [
      "3 usuários (+R$45 por usuário extra)",
      "Todos os módulos do seu ramo",
      "Perfis e permissões da equipe",
      "Documentos e impressão",
      "Fiscal (NF-e / NFC-e)",
      "Exportação para planilha",
      "150 créditos de IA por mês",
      "Suporte por e-mail",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 349,
    seats: 10,
    description: "Para a clínica ou loja com equipe e processo.",
    featured: false,
    contactSales: false,
    // A separação com o Professional fica limpa: lá se CONTROLA o acesso, aqui
    // se PROVA o que aconteceu (auditoria) e se AUTOMATIZA (API, integrações).
    adds: [
      "audit.log",
      "api.access",
      "multi.location",
      "purchasing.workflow",
    ],
    aiCredits: 800,
    extraSeatPrice: 35,
    // A auditoria só voltou a ser anunciada depois que a CONSULTA existiu
    // (/auditoria). A gravação já rodava em todo plano; sem tela para lê-la, o
    // bullet vendia um registro que ninguém conseguia abrir.
    features: [
      "10 usuários (+R$35 por usuário extra)",
      "Tudo do Professional",
      "Auditoria: quem alterou o quê, e quando",
      "API e integrações",
      "Multi-local e fluxo de compras",
      "800 créditos de IA por mês",
      "Suporte prioritário",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 899,
    seats: 30,
    description: "Para redes, franquias e operação multiempresa.",
    featured: false,
    // Preço publicado E auto-contratável. Mostrar R$899 e ainda assim obrigar a
    // falar com alguém não protege margem — só adiciona atrito para quem já
    // decidiu. A conversa com vendas passa a ser sobre implantação, migração e
    // SLA, que é onde ela realmente agrega.
    contactSales: false,
    adds: ["multi.company", "white.label", "priority.processing"],
    aiCredits: -1,
    extraSeatPrice: 25,
    features: [
      "30 usuários (+R$25 por usuário extra)",
      "Tudo do Business",
      "Multiempresa e consolidação",
      "Marca própria no portal do cliente",
      "IA sem teto e limites de uso ampliados",
      "Implantação assistida e SLA",
      "Gerente de conta",
    ],
  },
];

/**
 * Card do teste — DERIVADO do plano que ele entrega, nunca digitado à mão.
 *
 * O teste dá a experiência inteira do Professional de propósito: o cliente
 * precisa ver o produto funcionando com os dados DELE para decidir. Um teste
 * capado demonstra a versão limitada, não o produto.
 *
 * Os números eram digitados aqui e divergiram do que `createWorkspace` cria de
 * fato: o card anunciava 2 usuários e 60 créditos enquanto a assinatura de teste
 * nascia com os 3 assentos e os 150 créditos do Professional. Anunciar menos do
 * que se entrega ainda é anunciar errado — e a causa era o dado duplicado.
 */
const TRIAL_SOURCE = PAID_PLANS.find((p) => p.id === TRIAL_PLAN)!;

const TRIAL_CARD: PlanDef = {
  id: "starter",
  name: "Teste",
  priceMonthly: 0,
  seats: TRIAL_SOURCE.seats,
  description: `${TRIAL_DAYS} dias com o ${TRIAL_SOURCE.name} completo.`,
  featured: false,
  contactSales: false,
  // Vazio de propósito: quem está em teste tem a assinatura no plano do teste,
  // então as capacidades vêm de lá. Repetir aqui criaria duas verdades.
  adds: [],
  aiCredits: TRIAL_SOURCE.aiCredits,
  extraSeatPrice: null,
  features: [
    `${TRIAL_DAYS} dias, sem cartão`,
    `${TRIAL_SOURCE.name} completo liberado`,
    `${TRIAL_SOURCE.aiCredits} créditos de IA`,
    "Suporte por e-mail",
  ],
};

/** Catálogo de planos. A ordem define a ordem de exibição na interface. */
export const PLAN_CATALOG: PlanDef[] = [TRIAL_CARD, ...PAID_PLANS];

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
  /** Plano aguardando confirmação de pagamento no gateway (checkout iniciado). */
  pendingPlan: PlanId | null;
}

const PLAN_BY_ID = new Map(PLAN_CATALOG.map((p) => [p.id, p]));

export function planById(id: string): PlanDef | undefined {
  return PLAN_BY_ID.get(id as PlanId);
}

/** Garante um PlanId válido (fallback no Starter para dados inesperados). */
export function asPlanId(id: string): PlanId {
  return PLAN_BY_ID.has(id as PlanId) ? (id as PlanId) : "starter";
}

/**
 * Módulos que exigem capacidade de plano. O que não está aqui é liberado em
 * qualquer plano — a lista é curta de propósito.
 *
 * Fica de fora o núcleo de compras (fornecedores, pedido, recebimento): a loja
 * pequena precisa comprar e receber mercadoria para operar. O que é cobrado é o
 * FLUXO COM ALÇADA (solicitar → aprovar → cotar), que só existe onde há
 * hierarquia — e onde há hierarquia já há equipe pagando por assentos.
 */
export const MODULE_PLAN_FEATURE: Record<string, PlanFeature> = {
  solicitacoes: "purchasing.workflow",
  aprovacoes: "purchasing.workflow",
  cotacoes: "purchasing.workflow",
  transferencias: "multi.location",
  conferencia: "multi.location",
};

export function modulePlanFeature(moduleId: string): PlanFeature | null {
  return MODULE_PLAN_FEATURE[moduleId] ?? null;
}

/**
 * Data em que as capacidades por plano passaram a valer.
 *
 * A assinatura só é materializada no checkout, então "não tem assinatura" é
 * ambíguo: pode ser cliente antigo que nunca mexeu em cobrança ou empresa
 * recém-criada. A data de criação da organização desfaz a ambiguidade — quem
 * nasceu antes desta data é legado, sem depender de haver linha de assinatura.
 */
export const PLAN_ENFORCEMENT_SINCE = new Date("2026-08-05T00:00:00.000Z");

export function isLegacyOrg(createdAt: Date | null | undefined): boolean {
  return !!createdAt && createdAt.getTime() < PLAN_ENFORCEMENT_SINCE.getTime();
}

/**
 * O plano libera a capacidade?
 *
 * CUMULATIVO: percorre a hierarquia até o plano do cliente, então o Business
 * recebe tudo que o Professional dá sem repetir a lista.
 *
 * DIREITO ADQUIRIDO (`legacyFullAccess`): quem já usava o sistema antes de os
 * planos passarem a valer mantém tudo liberado. Tirar uma função de quem já
 * trabalha com ela é a forma mais rápida de perder o cliente — e a receita de
 * um upgrade forçado não paga o cancelamento que ele provoca. Contrato novo
 * nasce com a regra nova.
 */
export function planAllows(
  plan: string,
  feature: PlanFeature,
  opts: { legacyFullAccess?: boolean } = {},
): boolean {
  if (opts.legacyFullAccess) return true;
  const target = asPlanId(plan);
  for (const id of PLAN_ORDER) {
    const def = planById(id);
    if (def?.adds.includes(feature)) return true;
    if (id === target) return false; // chegou ao plano do cliente sem encontrar
  }
  return false;
}

/** Todas as capacidades liberadas por um plano — para telas de comparação. */
export function planCapabilities(plan: string): PlanFeature[] {
  const target = asPlanId(plan);
  const out: PlanFeature[] = [];
  for (const id of PLAN_ORDER) {
    const def = planById(id);
    if (def) out.push(...def.adds);
    if (id === target) break;
  }
  return out;
}

/** Menor plano que libera a capacidade — é o que a tela de bloqueio oferece. */
export function planRequiredFor(feature: PlanFeature): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (planById(id)?.adds.includes(feature)) return id;
  }
  return null;
}

/** Créditos de IA do ciclo. -1 = sem teto. */
export function planAiCredits(plan: string): number {
  return planById(asPlanId(plan))?.aiCredits ?? 0;
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
