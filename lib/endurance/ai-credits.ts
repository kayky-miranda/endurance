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

/** Instante a partir do qual a janela de 30 dias ainda é a atual. */
const janelaAtual = () => new Date(Date.now() - WINDOW_MS);

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
  const included = balance.included;

  if (balance.remaining < cost) {
    return {
      ok: false,
      remaining: balance.remaining,
      error:
        "Os créditos de IA deste ciclo acabaram. Faça upgrade do plano para continuar usando os recursos com inteligência artificial.",
    };
  }

  // DÉBITO CONDICIONAL: o teto entra no `where`, então quem autoriza é o banco.
  //
  // Antes a checagem acima decidia e o incremento vinha depois, sem trava. O
  // comentário dizia que chamadas simultâneas podiam "estourar o teto por uma
  // unidade" — medindo, não era. Vinte chamadas em paralelo com três créditos
  // de folga passaram TODAS e o contador terminou 37 acima da cota, porque
  // todas leem o saldo antes de qualquer uma incrementar: o excesso cresce com
  // o número de chamadas, não com uma unidade.
  //
  // Continua sendo uma consulta só, sem serializar nada: o UPDATE só encontra
  // a linha se ainda couber o custo, e `count === 0` significa que outra
  // chamada chegou primeiro.
  if (balance.windowExpired) {
    // Virada de ciclo: zera e já cobra este uso. A condição na janela evita
    // que duas chamadas simultâneas reiniciem a janela duas vezes.
    const virada = await prisma.subscription.updateMany({
      where: { organizationId: orgId, aiCreditsSince: { lt: janelaAtual() } },
      data: { aiCreditsUsed: cost, aiCreditsSince: new Date() },
    });
    if (virada.count > 0) return { ok: true, remaining: included - cost };
    // Outra chamada virou a janela primeiro: segue pelo caminho normal.
  }

  const debitado = await prisma.subscription.updateMany({
    where: {
      organizationId: orgId,
      aiCreditsUsed: { lte: included - cost },
    },
    data: { aiCreditsUsed: { increment: cost } },
  });
  if (debitado.count === 0) {
    return {
      ok: false,
      remaining: 0,
      error:
        "Os créditos de IA deste ciclo acabaram. Faça upgrade do plano para continuar usando os recursos com inteligência artificial.",
    };
  }

  return { ok: true, remaining: Math.max(0, balance.remaining - cost) };
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
