import "server-only";
import { prisma } from "@/lib/db";
import { planAiCredits } from "./billing";
import { resolvePlanContext } from "./plan-limits";

/**
 * Créditos de IA do plano principal.
 *
 * Por que crédito e não bloqueio por plano: a IA é o diferencial do produto.
 * Escondê-la no plano mais caro faria a maioria dos clientes nunca experimentar
 * aquilo que justificaria pagar mais. Todo plano prova a IA; o VOLUME é que é
 * cobrado — e volume é justamente onde está o custo real, porque cada chamada ao
 * modelo tem preço.
 *
 * NÃO se confunde com os créditos do módulo de Marketing, que rodam sobre uma
 * assinatura própria (`MarketingSubscription`) com plano próprio. São produtos
 * distintos e continuam separados de propósito.
 *
 * A janela é a mesma do ciclo de cobrança e zera de forma PREGUIÇOSA, na
 * primeira chamada após vencer — sem tarefa agendada, que seria mais uma peça
 * para manter no ar e falhar em silêncio.
 */

/** Recursos que consomem crédito. Espelha os módulos que chamam o modelo. */
export const AI_FEATURES = [
  "clinical_analysis",
  "clinical_evolution",
  "clinical_summary",
  "clinical_suggestions",
  "anamnese_summary",
  "text_proofread",
  "assistant",
  "sales_insights",
  "clinic_insights",
  "stock_advice",
  "pricing_advice",
  "crosssell",
  "crm_campaigns",
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * Custo em créditos. Proporcional ao trabalho REAL do modelo, medido pela
 * telemetria: o que gera texto longo e estruturado custa mais que o que devolve
 * três frases.
 *
 * O onboarding NÃO está aqui de propósito — roda antes de a empresa existir,
 * durante o cadastro. Cobrar ali bloquearia a entrada de um cliente novo.
 */
export const AI_FEATURE_COST: Record<AiFeature, number> = {
  clinical_analysis: 3, // ~1.200 tokens de saída estruturada, o mais pesado
  assistant: 2, // contexto grande (~2.900 tokens de entrada) e multi-turno
  clinical_evolution: 1,
  clinical_summary: 1,
  clinical_suggestions: 1,
  anamnese_summary: 1,
  text_proofread: 1,
  sales_insights: 1,
  clinic_insights: 1,
  stock_advice: 1,
  pricing_advice: 1,
  crosssell: 1,
  crm_campaigns: 1,
};

export interface AiBalance {
  /** Teto do ciclo. -1 = sem teto. */
  included: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  /** Quando o contador zera. */
  resetsAt: Date;
  /**
   * A janela venceu e o contador ainda não foi zerado no banco. Precisa ser
   * explícito: "usou 0" acontece tanto em ciclo vencido quanto em assinatura
   * nova, e tratar os dois igual renovaria a janela a cada primeiro uso.
   */
  windowExpired: boolean;
}

const WINDOW_MS = 30 * 86_400_000;

/**
 * Saldo do ciclo. Também usado pelo medidor da interface — limite invisível
 * gera chamado de suporte; limite visível gera upgrade.
 */
export async function getAiBalance(orgId: string): Promise<AiBalance> {
  const ctx = await resolvePlanContext(orgId);
  const included = planAiCredits(ctx.plan);
  const unlimited = included === -1;

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { aiCreditsUsed: true, aiCreditsSince: true },
  });

  const since = sub?.aiCreditsSince ?? new Date();
  const expired = Date.now() - since.getTime() >= WINDOW_MS;
  const used = expired ? 0 : (sub?.aiCreditsUsed ?? 0);
  const resetsAt = new Date((expired ? Date.now() : since.getTime()) + WINDOW_MS);

  return {
    included,
    used,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, included - used),
    unlimited,
    resetsAt,
    windowExpired: expired,
  };
}

export interface ConsumeResult {
  ok: boolean;
  remaining: number;
  error?: string;
}

/**
 * Reserva o crédito ANTES de chamar o modelo.
 *
 * Debitar antes e não depois é deliberado: a chamada é o que custa dinheiro,
 * mesmo quando a resposta vem ruim ou o usuário desiste no meio. Debitar só no
 * sucesso deixaria o custo escapar justamente nos casos de falha, que é quando
 * o cliente tende a repetir a operação.
 *
 * Devolve `ok:false` com mensagem pronta para a tela quando o saldo acabou —
 * o chamador não deve prosseguir para o modelo.
 */
export async function consumeAiCredit(
  orgId: string,
  feature: AiFeature,
): Promise<ConsumeResult> {
  const cost = AI_FEATURE_COST[feature] ?? 1;
  const balance = await getAiBalance(orgId);
  if (balance.unlimited) return { ok: true, remaining: Number.POSITIVE_INFINITY };

  if (balance.remaining < cost) {
    return {
      ok: false,
      remaining: balance.remaining,
      error:
        "Os créditos de IA deste ciclo acabaram. Faça upgrade do plano para continuar usando os recursos com inteligência artificial.",
    };
  }

  // O incremento é atômico no banco. A checagem acima não é, então duas
  // chamadas simultâneas podem estourar o teto por uma unidade — aceitável para
  // um limite de consumo, e muito mais barato que serializar toda chamada de IA.
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: balance.windowExpired
      ? { aiCreditsUsed: cost, aiCreditsSince: new Date() }
      : { aiCreditsUsed: { increment: cost } },
  });

  return { ok: true, remaining: balance.remaining - cost };
}

/**
 * Devolve o crédito quando a chamada nem chegou a acontecer (cota do provedor,
 * modelo indisponível). Falha do NOSSO lado não deve consumir o saldo do
 * cliente — ele não recebeu nada em troca.
 */
export async function refundAiCredit(
  orgId: string,
  feature: AiFeature,
): Promise<void> {
  const cost = AI_FEATURE_COST[feature] ?? 1;
  await prisma.subscription.updateMany({
    where: { organizationId: orgId, aiCreditsUsed: { gte: cost } },
    data: { aiCreditsUsed: { decrement: cost } },
  });
}
