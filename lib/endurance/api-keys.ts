import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Chaves da API pública (/api/v1). Token no formato `edk_<48 hex>` — mostrado
 * UMA única vez na criação; no banco fica apenas o SHA-256. Revogação é
 * imediata (revokedAt) e mantém a linha para auditoria.
 */

export const hashApiKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createApiKey(
  org: string,
  name: string,
  actor: { id: string; name: string },
): Promise<{ token: string; id: string; prefix: string }> {
  const token = `edk_${randomBytes(24).toString("hex")}`;
  const prefix = token.slice(0, 12);
  const created = await prisma.apiKey.create({
    data: {
      organizationId: org,
      name: name.trim().slice(0, 60) || "Chave de API",
      prefix,
      keyHash: hashApiKey(token),
      createdById: actor.id,
      createdByName: actor.name,
    },
  });
  return { token, id: created.id, prefix };
}

export async function listApiKeys(org: string) {
  return prisma.apiKey.findMany({
    where: { organizationId: org },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdByName: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function revokeApiKey(org: string, id: string): Promise<boolean> {
  const res = await prisma.apiKey.updateMany({
    where: { id, organizationId: org, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

/** Resolve o Bearer token de uma request da API pública → organização. */
export async function authenticateApiRequest(
  req: Request,
): Promise<{ org: string; keyId: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token.startsWith("edk_") || token.length < 20) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    select: { id: true, organizationId: true, revokedAt: true },
  });
  if (!key || key.revokedAt) return null;

  // lastUsedAt melhor-esforço (não bloqueia a resposta).
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { org: key.organizationId, keyId: key.id };
}
