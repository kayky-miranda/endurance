import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { allowedWhenDelinquent } from "@/lib/endurance/billing-gate";

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
  emailVerified?: boolean; // hidratado do banco em getSession()
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

export type PermissionCheck =
  | { ok: true; session: SessionPayload }
  | { ok: false; error: string };

/**
 * Guarda padrão das server actions mutantes: exige sessão válida, a permissão
 * granular E uma assinatura em dia. A UI esconder um botão não é autorização —
 * toda action que altera dados deve abrir com
 * `const gate = await requirePermission(...)`.
 *
 * O gate de assinatura mora AQUI, e não em cada action, porque durante muito
 * tempo ele existiu (`assertSubscriptionActive`) mas era chamado só nas ações de
 * equipe: na prática o teste de 14 dias nunca terminava — o cliente seguia
 * vendendo, emitindo nota e prescrevendo para sempre, impedido apenas de
 * convidar um colega. Ligar no ponto de estrangulamento comum é o que torna a
 * regra verdadeira em todo o sistema em vez de em três telas.
 *
 * LEITURA CONTINUA LIBERADA de propósito: só as mutações param. O cliente
 * inadimplente precisa conseguir consultar o histórico, exportar e pagar.
 */
export async function requirePermission(
  permId: import("@/lib/endurance/permissions").PermissionId,
): Promise<PermissionCheck> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada." };
  if (!sessionHasPermission(session, permId))
    return { ok: false, error: "Você não tem permissão para isso." };

  if (!allowedWhenDelinquent(permId)) {
    // Import dinâmico: plan-limits depende de db/billing e é carregado só
    // quando a checagem é necessária (mesmo padrão já usado em equipe-actions).
    const { assertSubscriptionActive } = await import(
      "@/lib/endurance/plan-limits"
    );
    const sub = await assertSubscriptionActive(session.org);
    if (!sub.ok)
      return { ok: false, error: sub.error ?? "Assinatura indisponível." };
  }

  return { ok: true, session };
}

/**
 * Combina requirePermission com a exigência de e-mail verificado. Usar em
 * mutações sensíveis: emissão fiscal (NFC-e/NF-e), troca de plano, qualquer
 * coisa que tenha consequência financeira ou comprometimento jurídico.
 */
export async function requirePermissionVerified(
  permId: import("@/lib/endurance/permissions").PermissionId,
): Promise<PermissionCheck> {
  const gate = await requirePermission(permId);
  if (!gate.ok) return gate;
  if (!gate.session.emailVerified)
    return {
      ok: false,
      error: "Confirme seu e-mail antes de executar esta ação.",
    };
  return gate;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não definido no ambiente (.env).");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  // `auth` = instante do login original. O middleware rotaciona o token a
  // cada ~24h de uso, mas nunca além de 30 dias deste marco (teto absoluto).
  return new SignJWT({ ...payload, auth: Math.floor(Date.now() / 1000) })
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
      emailVerifiedAt: true,
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
    emailVerified: !!user.emailVerifiedAt,
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

// Salt rounds 12 (~250ms/hash em CPU comum). Hashes antigos com rounds=10
// continuam validando — o custo fica embutido no próprio hash.
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Política de senha: ≥8 caracteres, com ao menos uma letra e um número.
 * Fonte única — usada no cadastro, na recuperação e na troca de senha.
 * Retorna a mensagem de erro (pt-BR) ou null se a senha for válida.
 */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8) return "A senha precisa ter ao menos 8 caracteres.";
  if (pw.length > 128) return "Senha muito longa (limite 128 caracteres).";
  if (!/[a-zA-Z]/.test(pw)) return "A senha precisa ter ao menos uma letra.";
  if (!/[0-9]/.test(pw)) return "A senha precisa ter ao menos um número.";
  return null;
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Verifica se um hash usa custo inferior ao atual (para rehash silencioso). */
export function needsRehash(hash: string): boolean {
  const m = hash.match(/^\$2[aby]\$(\d+)\$/);
  if (!m) return true;
  return Number(m[1]) < BCRYPT_ROUNDS;
}
