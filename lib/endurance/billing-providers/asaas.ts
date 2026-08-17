import "server-only";
import { timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import type {
  BillingProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  SubStatus,
} from "../billing-provider";

/**
 * Adapter Asaas (gateway BR: assinatura recorrente com PIX/boleto/cartão).
 * API REST v3, auth pelo header `access_token`. Sandbox vs produção por env.
 *
 * Docs: https://docs.asaas.com/
 */

// A chave do Asaas contém `$` (`$aact_prod_...`), que o pipeline de env da
// Vercel esvazia. Fallback: `ASAAS_API_KEY_B64` (base64, sem `$`) é decodificada
// aqui. Preferimos a chave direta se ela vier preenchida.
function resolveApiKey(): string | undefined {
  const direct = process.env.ASAAS_API_KEY;
  if (direct) return direct;
  const b64 = process.env.ASAAS_API_KEY_B64;
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  return undefined;
}

const API_KEY = resolveApiKey();
const ENV = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
const BASE =
  ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

async function asaas<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        access_token: API_KEY ?? "",
        "Content-Type": "application/json",
        "User-Agent": "ENDURANCE",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail =
        (Array.isArray(json.errors) &&
          (json.errors[0] as { description?: string })?.description) ||
        `asaas_${res.status}`;
      return { ok: false, status: res.status, error: String(detail) };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    logger.exception("Asaas — falha de rede/timeout", e);
    return { ok: false, status: 0, error: "network" };
  }
}

interface AsaasCustomer {
  id: string;
}
interface AsaasSubscription {
  id: string;
}
interface AsaasPaymentsList {
  data?: Array<{ invoiceUrl?: string }>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10); // yyyy-mm-dd
}

export const asaasProvider: BillingProvider = {
  id: "asaas",
  external: true,

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    if (!API_KEY) return { ok: false, error: "ASAAS_API_KEY ausente." };

    // 1. Cliente (externalReference = orgId, p/ o webhook resolver depois).
    const cust = await asaas<AsaasCustomer>("/customers", "POST", {
      name: input.customer.name,
      email: input.customer.email,
      cpfCnpj: input.customer.cpfCnpj || undefined,
      externalReference: input.orgId,
    });
    if (!cust.ok) return { ok: false, error: cust.error };

    // 2. Assinatura mensal.
    const sub = await asaas<AsaasSubscription>("/subscriptions", "POST", {
      customer: cust.data.id,
      billingType: input.method ?? "UNDEFINED",
      value: input.valueMonthly,
      cycle: "MONTHLY",
      nextDueDate: todayISO(),
      description: `ENDURANCE — plano ${input.planId}`,
      externalReference: input.orgId,
    });
    if (!sub.ok) return { ok: false, error: sub.error };

    // 3. Link de pagamento da 1ª cobrança (checkout hospedado). O Asaas
    // materializa o payment de forma assíncrona logo após criar a assinatura —
    // sem retry, o GET imediato costuma voltar vazio (race observada em teste).
    let invoiceUrl: string | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const pays = await asaas<AsaasPaymentsList>(
        `/subscriptions/${sub.data.id}/payments`,
        "GET",
      );
      invoiceUrl = pays.ok ? pays.data.data?.[0]?.invoiceUrl : undefined;
      if (invoiceUrl) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    if (!invoiceUrl)
      logger.warn("Asaas: assinatura criada mas 1ª cobrança sem invoiceUrl", {
        subscriptionId: sub.data.id,
      });

    return {
      ok: true,
      subscriptionId: sub.data.id,
      customerId: cust.data.id,
      invoiceUrl,
    };
  },

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!API_KEY) return { ok: false, error: "ASAAS_API_KEY ausente." };
    const r = await asaas(`/subscriptions/${subscriptionId}`, "DELETE");
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};

/**
 * Verifica o token do webhook Asaas (header `asaas-access-token`) contra
 * ASAAS_WEBHOOK_TOKEN, em tempo constante. Sem o token configurado, retorna
 * `verified:false` (processa em sandbox/dev mas registra que não verificou).
 */
export function verifyAsaasWebhook(headerToken: string | null): {
  ok: boolean;
  verified: boolean;
} {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    // Segredo ausente bloqueia em produção. Este token ESTÁ configurado hoje,
    // mas liberar sem ele deixava a porta aberta para o dia em que alguém
    // removesse a variável — e o webhook de cobrança ativa assinatura.
    if (process.env.NODE_ENV === "production") {
      logger.error("Webhook Asaas sem ASAAS_WEBHOOK_TOKEN definido — bloqueando");
      return { ok: false, verified: false };
    }
    logger.warn("Webhook Asaas sem ASAAS_WEBHOOK_TOKEN — liberando em dev");
    return { ok: true, verified: false };
  }
  if (!headerToken) return { ok: false, verified: false };
  const a = Buffer.from(headerToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, verified: false };
  return { ok: timingSafeEqual(a, b), verified: true };
}

/**
 * Mapeia o evento de webhook do Asaas → novo status da assinatura interna.
 * `null` = evento irrelevante (sem mudança de status).
 */
export function mapAsaasEvent(event: string): SubStatus | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "active";
    case "PAYMENT_OVERDUE":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
      return "past_due";
    case "SUBSCRIPTION_DELETED":
      return "canceled";
    default:
      return null;
  }
}
