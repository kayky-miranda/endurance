import "server-only";
import { createHmac, randomBytes, createHash } from "node:crypto";

/**
 * Implementação de TOTP (RFC 6238) + HOTP (RFC 4226) pura em Node — sem
 * dependência externa. Compatível com Google Authenticator, 1Password,
 * Authy, Microsoft Authenticator e qualquer cliente padrão.
 *
 * Parâmetros: HMAC-SHA1, dígitos=6, intervalo=30s (configuráveis).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Gera segredo aleatório em base32 (160 bits — padrão Google Authenticator). */
export function generateTotpSecret(): string {
  return randomBase32(20); // 20 bytes = 32 chars base32
}

function randomBase32(bytes: number): string {
  const buf = randomBytes(bytes);
  let out = "";
  for (let i = 0; i < buf.length; i += 5) {
    const slice = buf.subarray(i, i + 5);
    out += chunkToBase32(slice);
  }
  return out;
}

function chunkToBase32(buf: Buffer): string {
  // Cada 5 bytes (40 bits) viram 8 chars base32 (5 bits cada).
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

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

/**
 * HOTP (RFC 4226): conta → código de N dígitos.
 * O TOTP usa a janela de tempo como o counter.
 */
function hotp(secret: Buffer, counter: number, digits = 6): string {
  // Counter em 8 bytes big-endian.
  const ctr = Buffer.alloc(8);
  // bitwise não funciona em 53-bit ints; usamos BigInt pra segurança.
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

const STEP_SECONDS = 30;
const DIGITS = 6;

/** Gera o código TOTP atual (uso em testes / debug). */
export function totpCode(secretBase32: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter, DIGITS);
}

/**
 * Verifica se `code` é válido pro `secret` no momento atual. Aceita uma
 * janela de ±1 step (30s antes/depois) para tolerar drift de relógio do
 * celular. Não verifica replay aqui — fica a cargo do caller (ex.: rejeitar
 * o mesmo código duas vezes seguidas).
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const current = Math.floor(atMs / 1000 / STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    if (hotp(secret, current + offset, DIGITS) === code) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Backup codes — single-use, exibidos uma única vez no setup.
// ---------------------------------------------------------------------------

/** 8 códigos no formato XXXX-XXXX (4 dígitos + hífen + 4 dígitos). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = randomBytes(4);
    // 32 bits → 8 chars hex, formatado XXXX-XXXX (legível à mão).
    const hex = buf.toString("hex").toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }
  return codes;
}

/** Normaliza um código vindo do user antes de comparar (uppercase, sem hifens/espaços). */
export function normalizeBackupCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Hash determinístico pra guardar no banco. Backup codes têm entropia alta (32 bits),
 * então SHA-256 é suficiente (bcrypt seria overkill aqui). */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

/**
 * Constrói a URL `otpauth://` pro QR code do autenticador.
 *  - `label`: "<accountName>" (ex.: e-mail do usuário)
 *  - `issuer`: nome da plataforma (ENDURANCE) — fica visível no app
 */
export function buildOtpauthUrl(opts: {
  secretBase32: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
