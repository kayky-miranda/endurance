import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildMpPaymentBody,
  mapMpStatus,
  mapIntentState,
  createMercadoPagoProvider,
} from "@/lib/endurance/pix-providers/mercadopago";
import { resolvePixProvider } from "@/lib/endurance/pix-provider";
import type { PixChargeInput } from "@/lib/endurance/pix-provider";

const INPUT: PixChargeInput = {
  ref: "TX123",
  amount: 25.5,
  descricao: "Venda PDV",
  expiraSegundos: 3600,
};

/** fetch falso: handler decide a resposta por método/URL. */
function fakeFetch(
  handler: (url: string, init: { method: string }) => { ok?: boolean; body?: unknown },
): typeof fetch {
  return (async (url: string, init: { method: string }) => {
    const r = handler(String(url), init);
    return { ok: r.ok ?? true, json: async () => r.body ?? {} } as Response;
  }) as unknown as typeof fetch;
}

describe("buildMpPaymentBody", () => {
  it("mapeia a cobrança para o corpo do MP (pix)", () => {
    const b = buildMpPaymentBody(INPUT);
    expect(b.transaction_amount).toBe(25.5);
    expect(b.payment_method_id).toBe("pix");
    expect((b.payer as { email: string }).email).toBe("comprador@example.com");
    expect(b.date_of_expiration).toBeTruthy();
  });
});

describe("mapMpStatus", () => {
  it("traduz os status do Mercado Pago", () => {
    expect(mapMpStatus("approved")).toBe("pago");
    expect(mapMpStatus("pending")).toBe("pendente");
    expect(mapMpStatus("in_process")).toBe("pendente");
    expect(mapMpStatus("cancelled", "expired")).toBe("expirado");
    expect(mapMpStatus("cancelled")).toBe("cancelado");
    expect(mapMpStatus("rejected")).toBe("cancelado");
    expect(mapMpStatus("desconhecido")).toBe("erro");
  });
});

describe("createMercadoPagoProvider", () => {
  it("createCharge devolve BR Code, QR e providerRef", async () => {
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: fakeFetch(() => ({
        body: {
          id: 99,
          status: "pending",
          point_of_interaction: {
            transaction_data: {
              qr_code: "000201...pix...",
              qr_code_base64: "QkFTRTY0",
            },
          },
        },
      })),
    });
    const r = await provider.createCharge(INPUT);
    expect(r.status).toBe("pendente");
    expect(r.brCode).toBe("000201...pix...");
    expect(r.qrImage).toBe("data:image/png;base64,QkFTRTY0");
    expect(r.providerRef).toBe("99");
  });

  it("createCharge propaga erro quando não há qr_code", async () => {
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: fakeFetch(() => ({ ok: false, body: { message: "saldo" } })),
    });
    const r = await provider.createCharge(INPUT);
    expect(r.status).toBe("erro");
    expect(r.mensagem).toContain("saldo");
  });

  it("getCharge marca pago com data de aprovação", async () => {
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: fakeFetch(() => ({
        body: {
          status: "approved",
          date_approved: "2026-06-13T10:00:00.000-03:00",
          transaction_details: { transaction_id: "E2E999" },
        },
      })),
    });
    const r = await provider.getCharge("99");
    expect(r.status).toBe("pago");
    expect(r.e2eId).toBe("E2E999");
    expect(r.paidAt).toBeInstanceOf(Date);
  });
});

describe("Mercado Pago Point (maquininha)", () => {
  it("mapIntentState traduz os estados da payment-intent", () => {
    expect(mapIntentState("FINISHED")).toBe("pago");
    expect(mapIntentState("ON_TERMINAL")).toBe("pendente");
    expect(mapIntentState("PROCESSING")).toBe("pendente");
    expect(mapIntentState("CANCELED")).toBe("cancelado");
    expect(mapIntentState("ABANDONED")).toBe("cancelado");
    expect(mapIntentState("ERROR")).toBe("erro");
  });

  it("listDevices normaliza os aparelhos pareados", async () => {
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: fakeFetch((url) => {
        expect(url).toContain("/point/integration-api/devices");
        return {
          body: {
            devices: [
              { id: "PAX_A910__SMARTPOS123", operating_mode: "PDV" },
              { id: "no-id-skip" === "" ? "" : "GERTEC__456" },
            ],
          },
        };
      }),
    });
    const devices = await provider.listDevices();
    expect(devices.map((d) => d.id)).toContain("PAX_A910__SMARTPOS123");
    expect(devices[0].mode).toBe("PDV");
  });

  it("createDeviceCharge envia centavos e devolve o id da intent (sem BR Code)", async () => {
    let sentBody: Record<string, unknown> | undefined;
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: ((url: string, init: { method: string; body?: string }) => {
        expect(String(url)).toContain("/devices/DEV1/payment-intents");
        sentBody = init.body ? JSON.parse(init.body) : undefined;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "intent_77", device_id: "DEV1" }),
        } as Response);
      }) as unknown as typeof fetch,
    });
    const r = await provider.createDeviceCharge("DEV1", {
      ref: "TX9",
      amount: 25.5,
      descricao: "Venda",
      expiraSegundos: 3600,
    });
    expect(sentBody?.amount).toBe(2550); // centavos
    expect((sentBody?.payment as { type: string }).type).toBe("pix");
    expect(r.status).toBe("pendente");
    expect(r.providerRef).toBe("intent_77");
    expect(r.brCode).toBe(""); // QR fica na tela da maquininha
  });

  it("getDeviceCharge marca pago quando a intent FINISHED", async () => {
    const provider = createMercadoPagoProvider({
      token: "TEST-abc",
      baseUrl: "https://api.mercadopago.com",
      fetchImpl: fakeFetch(() => ({
        body: { id: "intent_77", state: "FINISHED", payment: { id: 9001 } },
      })),
    });
    const r = await provider.getDeviceCharge("intent_77");
    expect(r.status).toBe("pago");
    expect(r.paymentRef).toBe("9001");
    expect(r.paidAt).toBeInstanceOf(Date);
  });
});

describe("resolvePixProvider (gating)", () => {
  const ENV = ["MERCADO_PAGO_ACCESS_TOKEN", "PIX_ALLOW_PRODUCTION"];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    ENV.forEach((k) => delete process.env[k]);
  });
  afterEach(() => {
    ENV.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it("provider vazio → simula", () => {
    expect(resolvePixProvider({ provider: "" }).kind).toBe("simulate");
  });

  it("mercadopago sem token → erro", () => {
    expect(resolvePixProvider({ provider: "mercadopago" }).kind).toBe("error");
  });

  it("token de teste → provider (homologação)", () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-abc";
    const r = resolvePixProvider({ provider: "mercadopago" });
    expect(r.kind).toBe("provider");
    if (r.kind === "provider") expect(r.ambiente).toBe("homologacao");
  });

  it("token de produção sem a flag → erro", () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP-prod";
    expect(resolvePixProvider({ provider: "mercadopago" }).kind).toBe("error");
  });

  it("produção liberada com flag + token", () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP-prod";
    process.env.PIX_ALLOW_PRODUCTION = "true";
    const r = resolvePixProvider({ provider: "mercadopago" });
    expect(r.kind).toBe("provider");
    if (r.kind === "provider") expect(r.ambiente).toBe("producao");
  });
});
