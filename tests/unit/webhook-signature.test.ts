import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyMercadoPagoSignature,
  verifyMetaSignature,
} from "@/lib/webhook-signature";

const MP_SECRET = "mp-test-secret-32-chars-aaaaaaaaaaa";
const META_SECRET = "meta-test-secret-32-chars-aaaaaaaa";

function makeMpRequest(opts: {
  dataId: string;
  requestId?: string;
  ts?: number;
  v1?: string;
}): Request {
  const ts = opts.ts ?? Date.now();
  const requestId = opts.requestId ?? "req-1";
  const manifest = `id:${opts.dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", MP_SECRET).update(manifest).digest("hex");
  const v1 = opts.v1 ?? expected;
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers: {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    },
  });
}

describe("verifyMercadoPagoSignature", () => {
  beforeEach(() => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = MP_SECRET;
  });
  afterEach(() => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  });

  it("aceita assinatura válida e timestamp recente", () => {
    const res = verifyMercadoPagoSignature(makeMpRequest({ dataId: "123" }), "123");
    expect(res).toEqual({ ok: true, verified: true });
  });

  it("rejeita assinatura adulterada", () => {
    const req = makeMpRequest({ dataId: "123", v1: "deadbeef".repeat(8) });
    const res = verifyMercadoPagoSignature(req, "123");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("mismatch");
  });

  it("rejeita assinatura com timestamp fora da janela (replay > 10min)", () => {
    const old = Date.now() - 11 * 60_000;
    const res = verifyMercadoPagoSignature(makeMpRequest({ dataId: "123", ts: old }), "123");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("expired");
  });

  it("rejeita quando o data.id no manifest difere do esperado", () => {
    // Assinatura foi gerada pra "123", mas estamos validando pra "999".
    const req = makeMpRequest({ dataId: "123" });
    const res = verifyMercadoPagoSignature(req, "999");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("mismatch");
  });

  it("rejeita sem header x-signature", () => {
    const req = new Request("https://x/", {
      method: "POST",
      headers: { "x-request-id": "r" },
    });
    const res = verifyMercadoPagoSignature(req, "123");
    expect(res.reason).toBe("no-signature");
  });

  it("sem MERCADO_PAGO_WEBHOOK_SECRET deixa passar com verified=false (dev)", () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const req = makeMpRequest({ dataId: "123" });
    const res = verifyMercadoPagoSignature(req, "123");
    expect(res.ok).toBe(true);
    expect(res.verified).toBe(false);
  });
});

describe("verifyMetaSignature", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = META_SECRET;
  });
  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  function sign(body: string): string {
    return "sha256=" + createHmac("sha256", META_SECRET).update(body).digest("hex");
  }

  it("aceita assinatura válida", () => {
    const body = '{"entry":[]}';
    const res = verifyMetaSignature(sign(body), body);
    expect(res).toEqual({ ok: true, verified: true });
  });

  it("rejeita assinatura adulterada", () => {
    const body = '{"entry":[]}';
    const res = verifyMetaSignature("sha256=" + "00".repeat(32), body);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("mismatch");
  });

  it("rejeita header mal formado", () => {
    const res = verifyMetaSignature("md5=abc", "body");
    expect(res.reason).toBe("malformed-signature");
  });

  it("rejeita header ausente", () => {
    const res = verifyMetaSignature(null, "body");
    expect(res.reason).toBe("no-signature");
  });

  it("sem META_APP_SECRET deixa passar com verified=false (dev)", () => {
    delete process.env.META_APP_SECRET;
    const res = verifyMetaSignature("sha256=irrelevante", "body");
    expect(res.ok).toBe(true);
    expect(res.verified).toBe(false);
  });
});
