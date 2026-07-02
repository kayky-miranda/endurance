import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Mantido em sincronia com SESSION_COOKIE/MAX_AGE em lib/auth.ts. Definido
// aqui (e não importado) para não puxar módulos server-only/bcrypt pro Edge.
const SESSION_COOKIE = "endurance_session";
const MAX_AGE = 60 * 60 * 24 * 7; // validade de cada token (7 dias)
const ROTATE_AFTER = 60 * 60 * 24; // renova tokens com mais de 24h de idade
const ABSOLUTE_MAX = 60 * 60 * 24 * 30; // teto: relogin obrigatório após 30 dias

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

/**
 * Rotação deslizante de sessão: usuários ativos ganham um token novo a cada
 * ~24h (um cookie roubado expira em ≤7 dias mesmo que o dono siga usando o
 * app), mas nunca além de 30 dias do login original (`auth`) — aí o exp
 * vence sem renovação e o login é exigido de novo.
 */
async function rotateIfStale(
  payload: JWTPayload,
  res: NextResponse,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const iat = typeof payload.iat === "number" ? payload.iat : now;
  if (now - iat < ROTATE_AFTER) return;

  const authTime = typeof payload.auth === "number" ? payload.auth : iat;
  if (now - authTime > ABSOLUTE_MAX) return; // teto atingido: deixa expirar

  const { iat: _iat, exp: _exp, nbf: _nbf, ...claims } = payload;
  const token = await new SignJWT({ ...claims, auth: authTime })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Apenas o espaço (área logada) é protegido. Home (onboarding) e /entrar
  // são públicos.
  if (pathname.startsWith("/espaco")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    let payload: JWTPayload | null = null;
    if (token) {
      try {
        payload = (await jwtVerify(token, secret())).payload;
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      const url = new URL("/entrar", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const res = NextResponse.next();
    await rotateIfStale(payload, res);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/espaco/:path*"],
};
