import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Logger silenciado — só nos importa o comportamento de envio/retry.
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), exception: vi.fn() },
}));

import {
  sendEmail,
  sendPaymentOverdueEmail,
  sendStockDigestEmail,
} from "@/lib/email";

const okResponse = (id = "id") => ({
  ok: true,
  status: 200,
  json: async () => ({ id }),
  text: async () => "",
});

const errResponse = (status: number, detail = "") => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => detail,
});

const msg = { to: "a@b.com", subject: "x", html: "<p>x</p>", text: "x" };

describe("sendEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("entra em modo stub quando não há RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r).toEqual({ ok: true, stub: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envia com sucesso na primeira tentativa", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.fn().mockResolvedValue(okResponse("id_1"));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r).toEqual({ ok: true, id: "id_1" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("não tenta de novo em erro permanente (403 — domínio não verificado)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.fn().mockResolvedValue(errResponse(403, "domain not verified"));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("resend_403");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo em falha transitória (500) e sucede", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(errResponse(500, "boom"))
      .mockResolvedValueOnce(okResponse("id_2"));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r).toEqual({ ok: true, id: "id_2" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("desiste após 3 tentativas em falhas transitórias persistentes (503)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.fn().mockResolvedValue(errResponse(503, "down"));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("resend_503");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("templates de negócio compõem e enviam (stub sem chave)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const overdue = await sendPaymentOverdueEmail({
      to: "dono@x.com",
      name: "Maria",
      orgName: "Mercadinho do Zé",
    });
    expect(overdue).toEqual({ ok: true, stub: true });

    const digest = await sendStockDigestEmail({
      to: "dono@x.com",
      name: "Maria",
      orgName: "Mercadinho do Zé",
      items: [
        { name: "Arroz 5kg", stock: 0, daysLeft: null, level: "rompido" },
        { name: "Feijão 1kg", stock: 4, daysLeft: 2.4, level: "critico" },
      ],
    });
    expect(digest).toEqual({ ok: true, stub: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("trata erro de rede como transitório e tenta de novo", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(okResponse("id_3"));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await sendEmail(msg);

    expect(r).toEqual({ ok: true, id: "id_3" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
