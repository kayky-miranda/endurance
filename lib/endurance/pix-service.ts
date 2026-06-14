import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import type { PixCharge } from "@prisma/client";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { buildPixBrCode, makeTxid } from "./pix-emv";
import { resolvePixProvider } from "./pix-provider";

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
}

export async function getPixConfigView(org: string): Promise<PixConfigView> {
  const c = await ensurePixConfig(org);
  return {
    provider: c.provider,
    pixKey: c.pixKey,
    beneficiario: c.beneficiario,
    cidade: c.cidade,
    expiraSegundos: c.expiraSegundos,
  };
}

export interface SavePixConfigInput {
  provider: string; // "" | "mercadopago"
  pixKey: string;
  beneficiario: string;
  cidade: string;
}

export async function savePixConfig(
  org: string,
  input: SavePixConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const provider = input.provider === "mercadopago" ? "mercadopago" : "";
  await prisma.pixConfig.upsert({
    where: { organizationId: org },
    create: {
      organizationId: org,
      provider,
      pixKey: (input.pixKey ?? "").trim().slice(0, 120),
      beneficiario: (input.beneficiario ?? "").trim().slice(0, 25),
      cidade: (input.cidade ?? "").trim().toUpperCase().slice(0, 15),
    },
    update: {
      provider,
      pixKey: (input.pixKey ?? "").trim().slice(0, 120),
      beneficiario: (input.beneficiario ?? "").trim().slice(0, 25),
      cidade: (input.cidade ?? "").trim().toUpperCase().slice(0, 15),
    },
  });
  return { ok: true };
}

export type PixChargeResult =
  | { ok: true; charge: PixChargeView }
  | { ok: false; error: string };

export interface CreatePixChargeInput {
  token: string; // token da venda do PDV (idempotência)
  amount: number;
  customerId?: string | null;
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

  if (resolution.kind === "provider") {
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

  // SIMULADO: BR Code montado a partir da chave PIX da empresa.
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
    if (resolution.kind === "provider")
      await resolution.provider.cancelCharge(charge.providerRef);
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
  const r = await resolution.provider.getCharge(charge.providerRef);
  if (r.status === "pago")
    return markPaid(charge.id, r.e2eId ?? "", r.paidAt ?? new Date());
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
