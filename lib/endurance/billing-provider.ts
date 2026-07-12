import "server-only";

/**
 * Abstração de provedor de cobrança recorrente (mesmo padrão de
 * fiscal-provider / pix-provider). Com ASAAS_API_KEY definido, usa o Asaas;
 * senão, o provedor "manual" (auto-gerido, comportamento atual do protótipo).
 *
 * Trocar de gateway = implementar BillingProvider noutro adapter.
 */

export type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionCustomer {
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface CreateSubscriptionInput {
  /** Vira o externalReference no gateway → o webhook resolve a org por ele. */
  orgId: string;
  planId: string;
  valueMonthly: number;
  customer: SubscriptionCustomer;
  method?: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
}

export interface CreateSubscriptionResult {
  ok: boolean;
  subscriptionId?: string;
  customerId?: string;
  /** Link de pagamento da primeira cobrança (checkout hospedado do gateway). */
  invoiceUrl?: string;
  error?: string;
}

export interface BillingProvider {
  id: string;
  /** true quando é um gateway real (não o stub manual). */
  external: boolean;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }>;
}

import { asaasProvider } from "./billing-providers/asaas";
import { manualProvider } from "./billing-providers/manual";

/** Escolhe o provedor conforme as envs disponíveis. */
export function resolveBillingProvider(): BillingProvider {
  // ASAAS_API_KEY tem `$` e a Vercel a esvazia; ASAAS_API_KEY_B64 (base64) é o
  // fallback à prova de `$`. Qualquer um dos dois habilita o gateway Asaas.
  const hasAsaas = Boolean(
    process.env.ASAAS_API_KEY || process.env.ASAAS_API_KEY_B64,
  );
  return hasAsaas ? asaasProvider : manualProvider;
}
