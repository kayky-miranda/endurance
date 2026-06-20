import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "@/lib/tokens";

describe("tokens", () => {
  it("generateToken devolve plain URL-safe e hash hex consistente", () => {
    const { plain, hash } = generateToken();
    // base64url: A-Z, a-z, 0-9, "-", "_". Sem "=" "+" "/".
    expect(plain).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(plain.length).toBeGreaterThanOrEqual(40); // 32 bytes em base64url ~= 43 chars
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(plain)).toBe(hash);
  });

  it("dois tokens diferentes geram hashes diferentes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.plain).not.toBe(b.plain);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hashToken é determinístico para o mesmo input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abcd"));
  });

  it("plain não contém caracteres que quebram URL", () => {
    for (let i = 0; i < 50; i++) {
      const { plain } = generateToken();
      expect(plain).not.toContain("/");
      expect(plain).not.toContain("+");
      expect(plain).not.toContain("=");
    }
  });
});
