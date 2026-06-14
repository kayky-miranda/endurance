import "server-only";
import type {
  PixProvider,
  PixChargeInput,
  PixChargeResult,
  PixChargeStatusResult,
  PixStatus,
  PixDevice,
} from "../pix-provider";

/**
 * Adapter do Mercado Pago (https://www.mercadopago.com.br) para cobrança PIX.
 *
 * API: POST /v1/payments com `payment_method_id: "pix"` cria a cobrança e
 * devolve o BR Code em `point_of_interaction.transaction_data` (qr_code =
 * copia-e-cola, qr_code_base64 = imagem). O status é consultado por GET
 * /v1/payments/{id}. Autenticação: Bearer com o access token.
 *
 * O `fetch` é injetável para permitir testes sem rede.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mapeia o status do Mercado Pago para o nosso enum. */
export function mapMpStatus(status?: string, detail?: string): PixStatus {
  switch (status) {
    case "approved":
      return "pago";
    case "pending":
    case "in_process":
    case "authorized":
      return "pendente";
    case "cancelled":
      // MP expira a cobrança como "cancelled" com detail "expired".
      return (detail ?? "").includes("expired") ? "expirado" : "cancelado";
    case "rejected":
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      return "erro";
  }
}

interface MpPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  message?: string;
  error?: string;
  date_approved?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  // O end-to-end id do PIX aparece, quando pago, no detalhe da transação.
  transaction_details?: { transaction_id?: string };
}

// --- Mercado Pago Point (maquininha) ---
interface MpDevicesResponse {
  devices?: Array<{ id?: string; operating_mode?: string }>;
  message?: string;
  error?: string;
}

interface MpIntentResponse {
  id?: string;
  state?: string; // OPEN | ON_TERMINAL | PROCESSING | FINISHED | CANCELED | ERROR | ABANDONED
  message?: string;
  error?: string;
  payment?: { id?: string | number };
}

/** Mapeia o estado da payment-intent do Point para o nosso enum. */
export function mapIntentState(state?: string): PixStatus {
  switch (state) {
    case "FINISHED":
      return "pago";
    case "CANCELED":
    case "ABANDONED":
      return "cancelado";
    case "ERROR":
      return "erro";
    case "OPEN":
    case "ON_TERMINAL":
    case "PROCESSING":
      return "pendente";
    default:
      return "pendente";
  }
}

export interface MercadoPagoDeps {
  token: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/** Monta o corpo do POST /v1/payments (função pura/testável). */
export function buildMpPaymentBody(input: PixChargeInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    transaction_amount: round2(input.amount),
    description: input.descricao || "Cobrança PIX",
    payment_method_id: "pix",
    payer: { email: input.payerEmail || "comprador@example.com" },
  };
  if (input.expiraSegundos > 0) {
    const exp = new Date(Date.now() + input.expiraSegundos * 1000);
    body.date_of_expiration = exp.toISOString();
  }
  if (input.notificationUrl) body.notification_url = input.notificationUrl;
  return body;
}

export function createMercadoPagoProvider(deps: MercadoPagoDeps): PixProvider {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const base = deps.baseUrl.replace(/\/$/, "");

  async function call(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<{ httpOk: boolean; data: MpPaymentResponse }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${deps.token}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: MpPaymentResponse = {};
    try {
      data = (await res.json()) as MpPaymentResponse;
    } catch {
      data = {};
    }
    return { httpOk: res.ok, data };
  }

  function firstError(d: MpPaymentResponse): string | undefined {
    return d.message || d.error || d.status_detail || undefined;
  }

  // Chamada genérica (endpoints do Point têm formatos próprios).
  async function callRaw<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<{ httpOk: boolean; data: T }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${deps.token}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = {} as T;
    try {
      data = (await res.json()) as T;
    } catch {
      data = {} as T;
    }
    return { httpOk: res.ok, data };
  }

  const cents = (n: number) => Math.round(n * 100);

  return {
    id: "mercadopago",

    async createCharge(input: PixChargeInput): Promise<PixChargeResult> {
      try {
        const { httpOk, data } = await call(
          "POST",
          "/v1/payments",
          buildMpPaymentBody(input),
          input.ref,
        );
        const status = mapMpStatus(data.status, data.status_detail);
        const td = data.point_of_interaction?.transaction_data;
        if (!httpOk || !td?.qr_code) {
          return {
            status: status === "erro" ? "erro" : status,
            txid: input.ref,
            brCode: td?.qr_code ?? "",
            mensagem:
              firstError(data) ?? "Falha ao criar a cobrança PIX no Mercado Pago.",
          };
        }
        return {
          status,
          txid: input.ref,
          brCode: td.qr_code,
          qrImage: td.qr_code_base64
            ? `data:image/png;base64,${td.qr_code_base64}`
            : td.ticket_url,
          providerRef: data.id != null ? String(data.id) : undefined,
        };
      } catch (e) {
        return {
          status: "erro",
          txid: input.ref,
          brCode: "",
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    async getCharge(providerRef: string): Promise<PixChargeStatusResult> {
      try {
        const { data } = await call(
          "GET",
          `/v1/payments/${encodeURIComponent(providerRef)}`,
        );
        const status = mapMpStatus(data.status, data.status_detail);
        return {
          status,
          e2eId: data.transaction_details?.transaction_id || undefined,
          paidAt:
            status === "pago" && data.date_approved
              ? new Date(data.date_approved)
              : undefined,
        };
      } catch (e) {
        return {
          status: "erro",
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    async cancelCharge(providerRef: string) {
      try {
        const { httpOk, data } = await call(
          "PUT",
          `/v1/payments/${encodeURIComponent(providerRef)}`,
          { status: "cancelled" },
        );
        if (httpOk || data.status === "cancelled") return { ok: true };
        return { ok: false, mensagem: firstError(data) ?? "Falha ao cancelar." };
      } catch (e) {
        return {
          ok: false,
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    // --- Maquininha (Mercado Pago Point) ---

    async listDevices(): Promise<PixDevice[]> {
      try {
        const { data } = await callRaw<MpDevicesResponse>(
          "GET",
          "/point/integration-api/devices",
        );
        return (data.devices ?? [])
          .filter((d): d is { id: string; operating_mode?: string } =>
            Boolean(d.id),
          )
          .map((d) => ({ id: d.id, name: d.id, mode: d.operating_mode }));
      } catch {
        return [];
      }
    },

    async createDeviceCharge(
      deviceId: string,
      input: PixChargeInput,
    ): Promise<PixChargeResult> {
      try {
        const { httpOk, data } = await callRaw<MpIntentResponse>(
          "POST",
          `/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents`,
          {
            amount: cents(input.amount), // Point usa centavos (inteiro)
            additional_info: {
              external_reference: input.ref,
              print_on_terminal: true,
            },
            payment: { type: "pix" },
          },
          input.ref,
        );
        if (!httpOk || !data.id)
          return {
            status: "erro",
            txid: input.ref,
            brCode: "",
            mensagem:
              data.message ??
              data.error ??
              "Falha ao enviar a cobrança para a maquininha.",
          };
        // QR aparece na TELA do terminal — não recebemos o BR Code aqui.
        return {
          status: "pendente",
          txid: input.ref,
          brCode: "",
          providerRef: data.id, // id da payment-intent
        };
      } catch (e) {
        return {
          status: "erro",
          txid: input.ref,
          brCode: "",
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    async getDeviceCharge(intentId: string): Promise<PixChargeStatusResult> {
      try {
        const { data } = await callRaw<MpIntentResponse>(
          "GET",
          `/point/integration-api/payment-intents/${encodeURIComponent(intentId)}`,
        );
        const status = mapIntentState(data.state);
        const paymentRef = data.payment?.id != null ? String(data.payment.id) : undefined;
        return {
          status,
          paymentRef,
          e2eId: paymentRef,
          paidAt: status === "pago" ? new Date() : undefined,
        };
      } catch (e) {
        return {
          status: "erro",
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },

    async cancelDeviceCharge(deviceId: string, intentId: string) {
      try {
        const { httpOk, data } = await callRaw<MpIntentResponse>(
          "DELETE",
          `/point/integration-api/devices/${encodeURIComponent(deviceId)}/payment-intents/${encodeURIComponent(intentId)}`,
        );
        if (httpOk) return { ok: true };
        return {
          ok: false,
          mensagem: data.message ?? data.error ?? "Falha ao cancelar na maquininha.",
        };
      } catch (e) {
        return {
          ok: false,
          mensagem: `Falha de comunicação com o Mercado Pago: ${
            (e as Error)?.message ?? e
          }`,
        };
      }
    },
  };
}
