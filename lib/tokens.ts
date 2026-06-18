import "server-only";
import { randomBytes, createHash } from "node:crypto";

/**
 * Geração e verificação de tokens single-use (reset de senha, confirmação de
 * e-mail). O token plain (URL-safe) é enviado por e-mail; no banco fica só o
 * SHA-256 — assim, vazamento do banco não vira "todos os links são válidos".
 */

export function generateToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString("base64url"); // 43 chars URL-safe
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}
