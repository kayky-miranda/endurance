import "server-only";
import { prisma } from "@/lib/db";
import { planAiCredits } from "./billing";
import { resolvePlanContext } from "./plan-limits";
import { recordAiUsage } from "./ai-telemetry";
import {
  AI_FEATURE_COST,
  BILLED_AI_FEATURES,
  type BilledAiFeature,
} from "./ai-features";

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

// A lista de recursos e os custos vivem em `./ai-features`, compartilhados com
// a telemetria — antes cada um tinha a sua e um recurso podia ser cobrado sem
// ser medido. Reexportados para não quebrar os call-sites existentes.
export const AI_FEATURES = BILLED_AI_FEATURES;
export type AiFeature = BilledAiFeature;
export { AI_FEATURE_COST };

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

/**
 * Envelope padrão de uma chamada de IA: cobra, executa, mede e devolve o
 * crédito se nada foi entregue.
 *
 * Existe para os call-sites pararem de repetir — antes cada recurso escrevia à
 * mão o débito, o reembolso e (quando lembrava) a telemetria. Foi assim que 13
 * recursos passaram a ser cobrados sem nunca serem medidos.
 *
 * `run` deve devolver `delivered: false` quando a IA não produziu resultado
 * (sem chave, cota do provedor, resposta vazia) — aí o crédito volta.
 */
export async function withAiCredit<T>(
  orgId: string,
  feature: AiFeature,
  run: () => Promise<{ value: T; delivered: boolean; fallback?: boolean }>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const credit = await consumeAiCredit(orgId, feature);
  if (!credit.ok) return { ok: false, error: credit.error! };

  const started = Date.now();
  try {
    const out = await run();
    if (!out.delivered) await refundAiCredit(orgId, feature);
    void recordAiUsage({
      organizationId: orgId,
      feature,
      provider: out.delivered ? "gemini" : "offline",
      latencyMs: Date.now() - started,
      ok: out.delivered,
      fallback: out.fallback ?? !out.delivered,
    });
    return { ok: true, value: out.value };
  } catch (err) {
    // A chamada falhou: o cliente não recebeu nada, então não paga.
    await refundAiCredit(orgId, feature);
    void recordAiUsage({
      organizationId: orgId,
      feature,
      provider: "gemini",
      latencyMs: Date.now() - started,
      ok: false,
      error: (err as Error)?.message?.slice(0, 200) ?? "erro",
    });
    throw err;
  }
}
