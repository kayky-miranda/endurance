import "server-only";
import { createMercadoPagoProvider } from "./pix-providers/mercadopago";

/**
 * Abstração de PROVEDOR PIX (PSP) para cobrança dinâmica no PDV.
 *
 * Mesmo padrão do provedor fiscal (`fiscal-provider.ts`): o adapter fala com o
 * PSP (Mercado Pago) e devolve o BR Code + status; aqui só resolvemos qual
 * caminho seguir. Trocar de PSP = implementar esta interface em outro adapter.
 *
 * Segurança: cobrança REAL é travada por padrão. O token do PSP fica em variável
 * de ambiente no servidor. Token de TESTE (Mercado Pago: prefixo "TEST-") libera
 * o sandbox; PRODUÇÃO exige token de produção E a flag PIX_ALLOW_PRODUCTION=true.
 * Sem provedor configurado, cai no modo SIMULADO (BR Code da chave). Nunca "cai"
 * silenciosamente na simulação quando o usuário pediu cobrança real.
 */

export type PixAmbiente = "homologacao" | "producao";

export type PixStatus = "pendente" | "pago" | "expirado" | "cancelado" | "erro";

export interface PixChargeInput {
  /** Referência idempotente (usamos o txid da cobrança). */
  ref: string;
  amount: number;
  descricao: string;
  /** E-mail do pagador (o Mercado Pago exige um). */
  payerEmail?: string;
  expiraSegundos: number;
  /** URL de webhook do PSP (opcional). */
  notificationUrl?: string;
}

export interface PixChargeResult {
  status: PixStatus;
  txid: string;
  brCode: string; // copia e cola (EMV)
  qrImage?: string; // data URL / URL da imagem do QR
  providerRef?: string; // id da cobrança no PSP
  expiresAt?: Date;
  mensagem?: string;
}

export interface PixChargeStatusResult {
  status: PixStatus;
  e2eId?: string;
  paidAt?: Date;
  /** Quando a payment-intent do terminal vira pagamento, o id do pagamento. */
  paymentRef?: string;
  mensagem?: string;
}

/** Maquininha (terminal) pareada ao PSP. */
export interface PixDevice {
  id: string;
  name: string;
  /** Modo operacional do aparelho (ex.: PDV / STANDALONE). */
  mode?: string;
}

export interface PixProvider {
  id: string;
  createCharge(input: PixChargeInput): Promise<PixChargeResult>;
  /** Consulta por `providerRef` (id do PSP). */
  getCharge(providerRef: string): Promise<PixChargeStatusResult>;
  cancelCharge(providerRef: string): Promise<{ ok: boolean; mensagem?: string }>;

  // --- Maquininha (terminal) ---
  /** Lista as maquininhas pareadas (para configurar o aparelho). */
  listDevices(): Promise<PixDevice[]>;
  /** Cria a cobrança PIX na tela do terminal; devolve o id da payment-intent. */
  createDeviceCharge(
    deviceId: string,
    input: PixChargeInput,
  ): Promise<PixChargeResult>;
  /** Consulta a payment-intent do terminal por id. */
  getDeviceCharge(intentId: string): Promise<PixChargeStatusResult>;
  /** Cancela a cobrança em aberto no terminal. */
  cancelDeviceCharge(
    deviceId: string,
    intentId: string,
  ): Promise<{ ok: boolean; mensagem?: string }>;
}

export interface PixConfigLike {
  provider: string; // "" simulado | "mercadopago"
}

export type PixResolution =
  | { kind: "simulate" }
  | { kind: "provider"; provider: PixProvider; ambiente: PixAmbiente }
  | { kind: "error"; error: string };

const MP_BASE = "https://api.mercadopago.com";

/**
 * Resolve o que fazer com a config PIX da empresa: simular (protótipo), cobrar
 * por PSP real, ou recusar com motivo claro (token ausente ou produção travada).
 */
export function resolvePixProvider(
  cfg: PixConfigLike,
  deps?: { fetchImpl?: typeof fetch },
): PixResolution {
  if (cfg.provider !== "mercadopago") return { kind: "simulate" };

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token)
    return {
      kind: "error",
      error: "Token do Mercado Pago não configurado no servidor.",
    };

  // Token de teste (sandbox) tem prefixo "TEST-". Qualquer outro é produção.
  const producao = !token.startsWith("TEST-");
  const ambiente: PixAmbiente = producao ? "producao" : "homologacao";

  if (producao && process.env.PIX_ALLOW_PRODUCTION !== "true")
    return {
      kind: "error",
      error:
        "Cobrança PIX em PRODUÇÃO está desabilitada nesta instalação. Use credenciais de teste (TEST-…) ou habilite PIX_ALLOW_PRODUCTION no servidor.",
    };

  const provider = createMercadoPagoProvider({
    token,
    baseUrl: MP_BASE,
    fetchImpl: deps?.fetchImpl,
  });
  return { kind: "provider", provider, ambiente };
}
