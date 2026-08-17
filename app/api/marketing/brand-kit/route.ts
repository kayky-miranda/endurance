import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveBrandKit } from "@/lib/endurance/marketing/carousel-templates";
import type { NicheOrOther } from "@/lib/endurance/catalog";

export const runtime = "nodejs";

const FONT_OPTIONS = [
  "Plus Jakarta Sans",
  "Inter",
  "Space Grotesk",
  "Playfair Display",
  "DM Sans",
  "Lora",
  "Nunito Sans",
  "Outfit",
  "Fraunces",
  "Work Sans",
  "Bricolage Grotesque",
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.org },
    select: { name: true, niche: true, brandKit: true },
  });
  if (!org) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  // Mescla brandKit salvo com defaults do nicho
  const kit = resolveBrandKit(
    (org.niche as NicheOrOther) ?? "outro",
    org.brandKit
      ? {
          primaryColor: org.brandKit.primaryColor,
          darkColor: org.brandKit.darkColor,
          lightColor: org.brandKit.lightColor,
          lightBg: org.brandKit.lightBg,
          darkBg: org.brandKit.darkBg,
          fontHeading: org.brandKit.fontHeading,
          fontBody: org.brandKit.fontBody,
          logoText: org.brandKit.logoText,
          tagline: org.brandKit.tagline,
          instagramHandle: org.brandKit.instagramHandle,
        }
      : undefined,
    org.name,
  );

  return NextResponse.json({ brandKit: kit, fonts: FONT_OPTIONS, customized: !!org.brandKit });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Sanitização básica
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fallback;
  const str = (v: unknown, max = 60) =>
    typeof v === "string" ? v.slice(0, max) : "";

  // Fonte é NOME DE FAMÍLIA, não texto livre: entra numa regra CSS
  // (`font-family: '...'`) do HTML que o renderizador executa num Chromium do
  // servidor. Truncar em 60 caracteres não impedia nada — 39 já fechavam o
  // bloco de estilo e abriam um script. Só letras, números e espaço.
  const fonte = (v: unknown, padrao: string) => {
    const limpo = (typeof v === "string" ? v : "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .trim()
      .slice(0, 40);
    return limpo || padrao;
  };

  // Handle do Instagram já tem formato restrito na origem: letras, números,
  // ponto e sublinhado. Aceitar mais do que isso só abria espaço para HTML.
  const handle = (typeof body.instagramHandle === "string" ? body.instagramHandle : "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9._]/g, "")
    .slice(0, 30);

  const data = {
    primaryColor: hex(body.primaryColor, "#6366F1"),
    darkColor: hex(body.darkColor, "#312E81"),
    lightColor: hex(body.lightColor, "#A5B4FC"),
    lightBg: hex(body.lightBg, "#F8F7FF"),
    darkBg: hex(body.darkBg, "#0F0E17"),
    fontHeading: fonte(body.fontHeading, "Plus Jakarta Sans"),
    fontBody: fonte(body.fontBody, "Plus Jakarta Sans"),
    logoText: str(body.logoText, 60),
    tagline: str(body.tagline, 120),
    instagramHandle: handle,
  };

  const kit = await prisma.brandKit.upsert({
    where: { organizationId: session.org },
    create: { organizationId: session.org, ...data },
    update: data,
  });

  return NextResponse.json({ brandKit: kit });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  await prisma.brandKit.deleteMany({ where: { organizationId: session.org } });
  return NextResponse.json({ ok: true });
}
