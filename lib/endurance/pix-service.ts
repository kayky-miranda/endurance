import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import type { PixCharge } from "@prisma/client";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { buildPixBrCode, makeTxid } from "./pix-emv";
import { resolvePixProvider, type PixDevice } from "./pix-provider";

/**
 * Camada de serviço PIX: orquestra config + provedor + persistência da cobrança.
 * Espelha o `fiscal-service.ts`: despacha entre cobrança SIMULADA (BR Code da
 * chave) e cobrança REAL via PSP. Idempotente por `token` (o token da venda do
 * PDV) — chamar duas vezes devolve a mesma cobrança.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PixChargeView {
  id: string;
  token: string;
  txid: string;
  amount: number;
  status: "pendente" | "pago" | "expirado" | "cancelado";
  brCode: string;
  qrImage: string;
  provider: string;
  simulate: boolean; // modo simulado → permite "confirmar pagamento" manual
  terminal: boolean; // cobrança exibida na maquininha (QR na tela do aparelho)
  expiresAt: string | null;
  paidAt: string | null;
}

function toView(c: PixCharge): PixChargeView {
  return {
    id: c.id,
    token: c.token,
    txid: c.txid,
    amount: money(c.amount),
    status: c.status as PixChargeView["status"],
    brCode: c.brCode,
    qrImage: c.qrImage,
    provider: c.provider,
    simulate: c.provider === "",
    terminal: c.terminal,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
  };
}

/** Lê a config PIX; cria uma padrão (modo simulado) se ainda não existir. */
export async function ensurePixConfig(org: string) {
  const existing = await prisma.pixConfig.findUnique({
    where: { organizationId: org },
  });
  if (existing) return existing;
  const o = await prisma.organization.findUnique({ where: { id: org } });
  return prisma.pixConfig.create({
    data: {
      organizationId: org,
      beneficiario: o?.name ?? "",
      cidade: (o?.city || "SAO PAULO").toUpperCase().slice(0, 15),
    },
  });
}

export interface PixConfigView {
  provider: string; // "" simulado | "mercadopago"
  pixKey: string;
  beneficiario: string;
  cidade: string;
  expiraSegundos: number;
  deviceId: string; // maquininha (Mercado Pago Point)
  hasDevice: boolean;
}

export async function getPixConfigView(org: string): Promise<PixConfigView> {
  const c = await ensurePixConfig(org);
  return {
    provider: c.provider,
    pixKey: c.pixKey,
    beneficiario: c.beneficiario,
    cidade: c.cidade,
    expiraSegundos: c.expiraSegundos,
    deviceId: c.deviceId,
    hasDevice: Boolean(c.deviceId),
  };
}

export interface SavePixConfigInput {
  provider: string; // "" | "mercadopago"
  pixKey: string;
  beneficiario: string;
  cidade: string;
  deviceId?: string;
}

export async function savePixConfig(
  org: string,
  input: SavePixConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const provider = input.provider === "mercadopago" ? "mercadopago" : "";
  const fields = {
    provider,
    pixKey: (input.pixKey ?? "").trim().slice(0, 120),
    beneficiario: (input.beneficiario ?? "").trim().slice(0, 25),
    cidade: (input.cidade ?? "").trim().toUpperCase().slice(0, 15),
    deviceId: (input.deviceId ?? "").trim().slice(0, 80),
  };
  await prisma.pixConfig.upsert({
    where: { organizationId: org },
    create: { organizationId: org, ...fields },
    update: fields,
  });
  return { ok: true };
}

/** Lista as maquininhas pareadas no PSP (para configurar o aparelho). */
export async function listPixDevices(
  org: string,
): Promise<{ ok: true; devices: PixDevice[] } | { ok: false; error: string }> {
  const cfg = await ensurePixConfig(org);
  const resolution = resolvePixProvider(cfg);
  if (resolution.kind === "error") return { ok: false, error: resolution.error };
  if (resolution.kind !== "provider")
    return {
      ok: false,
      error: "Selecione o Mercado Pago (real) para listar as maquininhas.",
    };
  return { ok: true, devices: await resolution.provider.listDevices() };
}

export type PixChargeResult =
  | { ok: true; charge: PixChargeView }
  | { ok: false; error: string };

export interface CreatePixChargeInput {
  token: string; // token da venda do PDV (idempotência)
  amount: number;
  customerId?: string | null;
  /** Exibir a cobrança na maquininha (Mercado Pago Point) em vez da tela. */
  terminal?: boolean;
}

/** Cria (ou recupera) a cobrança PIX de uma venda. */
export async function createPixCharge(
  org: string,
  input: CreatePixChargeInput,
): Promise<PixChargeResult> {
  const token = (input.token ?? "").trim();
  if (!token) return { ok: false, error: "Token da cobrança ausente." };
  const amount = round2(Number(input.amount) || 0);
  if (amount <= 0) return { ok: false, error: "Valor da cobrança inválido." };

  // Idempotência: mesma venda → mesma cobrança.
  const existing = await prisma.pixCharge.findUnique({ where: { token } });
  if (existing) return { ok: true, charge: toView(existing) };

  const cfg = await ensurePixConfig(org);
  const resolution = resolvePixProvider(cfg);
  if (resolution.kind === "error") return { ok: false, error: resolution.error };

  const txid = makeTxid(crypto.randomUUID().replace(/-/g, ""));
  const wantTerminal = Boolean(input.terminal);

  if (resolution.kind === "provider") {
    // MAQUININHA: cria a payment-intent no aparelho; o QR aparece na tela dele.
    if (wantTerminal) {
      if (!cfg.deviceId)
        return {
          ok: false,
          error: "Nenhuma maquininha configurada para esta empresa.",
        };
      const r = await resolution.provider.createDeviceCharge(cfg.deviceId, {
        ref: txid,
        amount,
        descricao: `Venda PDV ${txid.slice(0, 8)}`,
        expiraSegundos: cfg.expiraSegundos,
      });
      if (r.status === "erro")
        return { ok: false, error: r.mensagem ?? "Falha ao enviar à maquininha." };
      const charge = await prisma.pixCharge.create({
        data: {
          organizationId: org,
          token,
          txid: r.txid,
          amount,
          status: "pendente",
          brCode: "",
          qrImage: "",
          provider: resolution.provider.id,
          providerRef: r.providerRef ?? "",
          terminal: true,
          deviceId: cfg.deviceId,
          expiresAt: expiresFrom(cfg.expiraSegundos),
        },
      });
      return { ok: true, charge: toView(charge) };
    }

    // TELA: cobrança normal com BR Code na tela do caixa.
    let payerEmail: string | undefined;
    if (input.customerId) {
      const c = await prisma.customer.findUnique({
        where: { id: input.customerId },
      });
      if (c && c.organizationId === org && c.email) payerEmail = c.email;
    }
    const notificationUrl = pixWebhookUrl();
    const r = await resolution.provider.createCharge({
      ref: txid,
      amount,
      descricao: `Venda PDV ${txid.slice(0, 8)}`,
      payerEmail,
      expiraSegundos: cfg.expiraSegundos,
      notificationUrl,
    });
    if (r.status === "erro" || !r.brCode)
      return {
        ok: false,
        error: r.mensagem ?? "Falha ao gerar a cobrança PIX.",
      };
    const qrImage = r.qrImage ?? (await safeQr(r.brCode));
    const charge = await prisma.pixCharge.create({
      data: {
        organizationId: org,
        token,
        txid: r.txid,
        amount,
        status: r.status === "pago" ? "pago" : "pendente",
        brCode: r.brCode,
        qrImage,
        provider: resolution.provider.id,
        providerRef: r.providerRef ?? "",
        expiresAt: r.expiresAt ?? expiresFrom(cfg.expiraSegundos),
        paidAt: r.status === "pago" ? new Date() : null,
      },
    });
    return { ok: true, charge: toView(charge) };
  }

  // SIMULADO: BR Code montado a partir da chave PIX da empresa. Quando o caixa
  // pede "maquininha", marcamos terminal=true (a UI mostra o aviso de terminal)
  // e a confirmação continua manual (não há aparelho real).
  const brCode = buildPixBrCode({
    pixKey: cfg.pixKey || "demo@endurance.app",
    nome: cfg.beneficiario || "RECEBEDOR",
    cidade: cfg.cidade || "SAO PAULO",
    valor: amount,
    txid,
  });
  const qrImage = await safeQr(brCode);
  const charge = await prisma.pixCharge.create({
    data: {
      organizationId: org,
      token,
      txid,
      amount,
      status: "pendente",
      brCode,
      qrImage,
      provider: "",
      terminal: wantTerminal,
      deviceId: wantTerminal ? cfg.deviceId : "",
      expiresAt: expiresFrom(cfg.expiraSegundos),
    },
  });
  return { ok: true, charge: toView(charge) };
}

/** Status atual da cobrança; consulta o PSP quando real e ainda pendente. */
export async function getPixChargeStatus(
  org: string,
  chargeId: string,
): Promise<PixChargeResult> {
  const charge = await loadCharge(org, chargeId);
  if (!charge) return { ok: false, error: "Cobrança não encontrada." };
  const refreshed = await refreshCharge(charge);
  return { ok: true, charge: toView(refreshed) };
}

/** Confirma o pagamento no modo SIMULADO (não há PSP para confirmar). */
export async function confirmSimulatedPix(
  org: string,
  chargeId: string,
): Promise<PixChargeResult> {
  const charge = await loadCharge(org, chargeId);
  if (!charge) return { ok: false, error: "Cobrança não encontrada." };
  if (charge.provider !== "")
    return {
      ok: false,
      error: "Esta cobrança é real — a confirmação vem do provedor, não manual.",
    };
  if (charge.status === "pago") return { ok: true, charge: toView(charge) };
  if (charge.status !== "pendente")
    return { ok: false, error: "Cobrança não está mais pendente." };
  const updated = await markPaid(charge.id, `SIM${charge.txid.slice(0, 20)}`);
  return { ok: true, charge: toView(updated) };
}

/** Cancela a cobrança (e no PSP, quando real). */
export async function cancelPixCharge(
  org: string,
  chargeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const charge = await loadCharge(org, chargeId);
  if (!charge) return { ok: false, error: "Cobrança não encontrada." };
  if (charge.status === "pago")
    return { ok: false, error: "Cobrança já paga não pode ser cancelada." };
  if (charge.provider && charge.providerRef) {
    const cfg = await ensurePixConfig(org);
    const resolution = resolvePixProvider(cfg);
    if (resolution.kind === "provider") {
      if (charge.terminal && charge.deviceId)
        await resolution.provider.cancelDeviceCharge(
          charge.deviceId,
          charge.providerRef,
        );
      else await resolution.provider.cancelCharge(charge.providerRef);
    }
  }
  await prisma.pixCharge.update({
    where: { id: charge.id },
    data: { status: "cancelado" },
  });
  return { ok: true };
}

/** Marca a cobrança como paga (usado pelo webhook e pela confirmação simulada). */
export async function markPaid(
  chargeId: string,
  e2eId: string,
  paidAt: Date = new Date(),
): Promise<PixCharge> {
  return prisma.pixCharge.update({
    where: { id: chargeId },
    data: { status: "pago", paidAt, e2eId: e2eId.slice(0, 60) },
  });
}

/** Localiza a cobrança pelo id do PSP (entrada do webhook). */
export async function getChargeByProviderRef(
  providerRef: string,
): Promise<PixCharge | null> {
  if (!providerRef) return null;
  return prisma.pixCharge.findFirst({ where: { providerRef } });
}

/** Reconsulta o PSP e persiste a transição de status, quando aplicável. */
export async function refreshCharge(charge: PixCharge): Promise<PixCharge> {
  if (charge.status !== "pendente") return charge;
  if (!charge.provider || !charge.providerRef) return charge; // simulado
  const cfg = await ensurePixConfig(charge.organizationId);
  const resolution = resolvePixProvider(cfg);
  if (resolution.kind !== "provider") return charge;
  const r = charge.terminal
    ? await resolution.provider.getDeviceCharge(charge.providerRef)
    : await resolution.provider.getCharge(charge.providerRef);
  if (r.status === "pago")
    return markPaid(
      charge.id,
      r.e2eId ?? r.paymentRef ?? "",
      r.paidAt ?? new Date(),
    );
  if (r.status === "expirado" || r.status === "cancelado")
    return prisma.pixCharge.update({
      where: { id: charge.id },
      data: { status: r.status },
    });
  return charge;
}

async function loadCharge(org: string, chargeId: string): Promise<PixCharge | null> {
  const c = await prisma.pixCharge.findUnique({ where: { id: chargeId } });
  if (!c || c.organizationId !== org) return null;
  return c;
}

function expiresFrom(seconds: number): Date {
  return new Date(Date.now() + Math.max(60, seconds) * 1000);
}

function pixWebhookUrl(): string | undefined {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, "")}/api/pix/webhook` : undefined;
}

/** Gera o QR como data URL; em falha devolve "" (o copia-e-cola ainda funciona). */
async function safeQr(brCode: string): Promise<string> {
  try {
    return await QRCode.toDataURL(brCode, { margin: 1, width: 280 });
  } catch {
    return "";
  }
}
