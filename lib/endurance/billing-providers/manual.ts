import "server-only";
import type {
  BillingProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
} from "../billing-provider";

/**
 * Provedor "manual" (auto-gerido). Sem gateway externo: a assinatura é tratada
 * internamente (ativação imediata em billing-service.changePlan). Mantido como
 * fallback de dev/protótipo, espelhando o comportamento atual.
 */
export const manualProvider: BillingProvider = {
  id: "manual",
  external: false,

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    // Sem gateway: devolve um id sintético; a ativação real é feita pelo
    // changePlan (auto-gerido). Não há checkout hospedado.
    return {
      ok: true,
      subscriptionId: `manual_${input.orgId}_${input.planId}`,
      customerId: `manual_${input.orgId}`,
    };
  },

  async cancelSubscription(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  },
};
