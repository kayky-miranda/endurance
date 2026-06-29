import { describe, it, expect, afterEach, vi } from "vitest";
import { mapAsaasEvent, verifyAsaasWebhook } from "@/lib/endurance/billing-providers/asaas";

describe("mapAsaasEvent", () => {
  it("mapeia confirmação de pagamento para active", () => {
    expect(mapAsaasEvent("PAYMENT_CONFIRMED")).toBe("active");
    expect(mapAsaasEvent("PAYMENT_RECEIVED")).toBe("active");
  });

  it("mapeia atraso/estorno/chargeback para past_due", () => {
    expect(mapAsaasEvent("PAYMENT_OVERDUE")).toBe("past_due");
    expect(mapAsaasEvent("PAYMENT_REFUNDED")).toBe("past_due");
    expect(mapAsaasEvent("PAYMENT_CHARGEBACK_REQUESTED")).toBe("past_due");
  });

  it("mapeia exclusão da assinatura para canceled", () => {
    expect(mapAsaasEvent("SUBSCRIPTION_DELETED")).toBe("canceled");
  });

  it("eventos irrelevantes não mudam status (null)", () => {
    expect(mapAsaasEvent("PAYMENT_CREATED")).toBeNull();
    expect(mapAsaasEvent("QUALQUER_COISA")).toBeNull();
  });
});

describe("verifyAsaasWebhook", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem token configurado: processa porém não verificado", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "");
    expect(verifyAsaasWebhook("qualquer")).toEqual({ ok: true, verified: false });
  });

  it("token correto: ok e verificado", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "segredo-123");
    expect(verifyAsaasWebhook("segredo-123")).toEqual({ ok: true, verified: true });
  });

  it("token errado ou ausente: rejeita", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "segredo-123");
    expect(verifyAsaasWebhook("errado").ok).toBe(false);
    expect(verifyAsaasWebhook(null).ok).toBe(false);
  });
});
