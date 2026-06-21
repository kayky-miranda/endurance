import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  totpCode,
  verifyTotpCode,
  buildOtpauthUrl,
} from "@/lib/totp";

describe("generateTotpSecret", () => {
  it("gera segredo base32 de 32 chars (160 bits)", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(32);
  });

  it("gera segredos distintos a cada chamada", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe("totpCode / verifyTotpCode", () => {
  // Vetor de teste da RFC 6238 (secret ASCII "12345678901234567890" → base32):
  // Apêndice B da RFC dá códigos esperados em vários instantes.
  const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32 de "12345678901234567890"

  it("vetor RFC 6238 — t=59s gera código que termina em 287082", () => {
    const code = totpCode(SECRET, 59 * 1000);
    expect(code).toBe("287082");
  });

  it("vetor RFC 6238 — t=1111111109s gera 081804", () => {
    const code = totpCode(SECRET, 1111111109 * 1000);
    expect(code).toBe("081804");
  });

  it("código é sempre 6 dígitos", () => {
    for (let t = 1; t <= 200; t += 17) {
      const code = totpCode(SECRET, t * 1000);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("verifyTotpCode aceita o código gerado para o mesmo instante", () => {
    const now = Date.now();
    const code = totpCode(SECRET, now);
    expect(verifyTotpCode(SECRET, code, now)).toBe(true);
  });

  it("verifyTotpCode aceita janela de ±30s (drift de relógio)", () => {
    const t = Date.now();
    const previousCode = totpCode(SECRET, t - 30_000);
    const nextCode = totpCode(SECRET, t + 30_000);
    expect(verifyTotpCode(SECRET, previousCode, t)).toBe(true);
    expect(verifyTotpCode(SECRET, nextCode, t)).toBe(true);
  });

  it("verifyTotpCode rejeita código de 2 steps atrás", () => {
    const t = Date.now();
    const oldCode = totpCode(SECRET, t - 70_000); // ~ -2.3 steps
    expect(verifyTotpCode(SECRET, oldCode, t)).toBe(false);
  });

  it("verifyTotpCode rejeita formato inválido", () => {
    expect(verifyTotpCode(SECRET, "12345")).toBe(false);
    expect(verifyTotpCode(SECRET, "abcdef")).toBe(false);
    expect(verifyTotpCode(SECRET, "1234567")).toBe(false);
  });

  it("código gerado é diferente entre dois secrets distintos", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    const t = Date.now();
    expect(totpCode(a, t)).not.toBe(totpCode(b, t));
  });
});

describe("buildOtpauthUrl", () => {
  it("constrói URL otpauth padrão", () => {
    const url = buildOtpauthUrl({
      secretBase32: "JBSWY3DPEHPK3PXP",
      accountName: "user@example.com",
      issuer: "ENDURANCE",
    });
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toMatch(/ENDURANCE%3Auser%40example\.com/);
    expect(url).toMatch(/secret=JBSWY3DPEHPK3PXP/);
    expect(url).toMatch(/issuer=ENDURANCE/);
    expect(url).toMatch(/digits=6/);
    expect(url).toMatch(/period=30/);
  });
});
