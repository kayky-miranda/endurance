import { createHmac } from "node:crypto";

/**
 * Helper standalone (sem `server-only`) pra calcular o código TOTP nos
 * testes E2E. Espelho funcional de `lib/totp.ts`. Mantemos duplicado pra
 * não ter que importar uma lib server-only no Playwright.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error(`Caractere inválido na base32: ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const ctr = Buffer.alloc(8);
  let big = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    ctr[i] = Number(big & 0xffn);
    big >>= 8n;
  }
  const hmac = createHmac("sha1", secret).update(ctr).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totpCode(secretBase32: string, atMs: number = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / 30_000), 6);
}
