import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Mantido em sincronia com SESSION_COOKIE em lib/auth.ts. Definido aqui (e não
// importado) para não puxar módulos server-only/bcrypt para o bundle do Edge.
const SESSION_COOKIE = "endurance_session";

async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Apenas o espaço (área logada) é protegido. Home (onboarding) e /entrar
  // são públicos.
  if (pathname.startsWith("/espaco")) {
    if (!(await isAuthed(req))) {
      const url = new URL("/entrar", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/espaco/:path*"],
};
