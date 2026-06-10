import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "endurance_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface SessionPayload {
  sub: string; // user id
  name: string;
  email: string;
  role: Role;
  org: string; // organizationId
  slug: string; // slug da organização (para redirecionar sem consultar o banco)
  profile?: string; // id do perfil pré-configurado
  permissions?: string[]; // ids de permissão (RBAC granular)
}

/** OWNER e ADMIN podem gerenciar a equipe; MEMBER não. */
export function canManageTeam(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Pode gerenciar a equipe se for OWNER/ADMIN OU tiver a permissão team.manage.
 * Usada nas telas/ações de Gestão de Usuários (RBAC granular).
 */
export function canManageTeamSession(session: SessionPayload): boolean {
  return (
    canManageTeam(session.role) ||
    Boolean(session.permissions?.includes("team.manage"))
  );
}

/** Verifica uma permissão granular na sessão (OWNER/ADMIN têm acesso total). */
export function sessionHasPermission(
  session: SessionPayload,
  permId: string,
): boolean {
  if (session.role === "OWNER" || session.role === "ADMIN") return true;
  return Boolean(session.permissions?.includes(permId));
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não definido no ambiente (.env).");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      org: String(payload.org),
      slug: String(payload.slug),
      profile: payload.profile ? String(payload.profile) : "",
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as string[])
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Carrega o usuário do banco para hidratar a autorização. Deduplicado por
 * request com React cache() — várias chamadas a getSession() no mesmo render
 * batem no banco uma única vez.
 */
const loadUserForSession = cache(async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profile: true,
      permissions: true,
      status: true,
      organizationId: true,
    },
  });
});

/**
 * Lê a sessão atual (Server Components / Actions).
 *
 * O JWT prova a IDENTIDADE (sub/org/slug). Já a AUTORIZAÇÃO (papel, permissões,
 * status) é sempre relida do banco — assim, mudanças feitas pelo admin valem no
 * próximo request, sem esperar novo login, e um usuário bloqueado perde acesso
 * na hora (getSession passa a devolver null para ele).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const user = await loadUserForSession(claims.sub);
  // Usuário removido, movido de organização ou bloqueado → sem sessão válida.
  if (!user || user.organizationId !== claims.org) return null;
  if (user.status === "blocked") return null;

  return {
    ...claims,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    profile: user.profile,
    permissions: user.permissions,
  };
}

/** Grava o cookie de sessão. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Remove o cookie de sessão (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Exige sessão válida com acesso ao espaço de `slug`. Redireciona para /entrar
 * se não logado, ou para o próprio espaço se logado em outra organização.
 * Use no topo de Server Components do espaço.
 */
export async function requireOrgAccess(slug: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect(`/entrar?next=/espaco/${slug}`);
  if (session.slug !== slug) redirect(`/espaco/${session.slug}`);
  return session;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
