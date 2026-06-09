import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

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
}

/** OWNER e ADMIN podem gerenciar a equipe; MEMBER não. */
export function canManageTeam(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
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
    };
  } catch {
    return null;
  }
}

/** Lê a sessão atual a partir do cookie (Server Components / Actions). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
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
