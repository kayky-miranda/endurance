import { NextResponse } from "next/server";
import { getSession, sessionHasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCarousel } from "@/lib/endurance/marketing/carousel-generator";
import { renderCarouselToPNGs } from "@/lib/endurance/marketing/carousel-renderer";
import { debitCredits, refundCredits } from "@/lib/endurance/marketing/credits";
import { logger } from "@/lib/logger";
import { hitAi } from "@/lib/endurance/ai-throttle";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Autorização granular (a UI já esconde o botão, mas a API é o gate real).
  if (!sessionHasPermission(session, "marketing.manage"))
    return NextResponse.json({ error: "Sem permissão para gerar campanhas." }, { status: 403 });

  // Marketing gera conteúdo que será exibido publicamente (Instagram) — exige
  // e-mail verificado para reduzir uso por contas descartáveis.
  if (!session.emailVerified)
    return NextResponse.json(
      { error: "Confirme seu e-mail antes de gerar campanhas." },
      { status: 403 },
    );

  // Rate limit por organização — geração custa crédito + chamada de IA.
  if (!(await hitAi(session.org, `ai:carousel:${session.org}`, 10, 60_000)).ok) {
    return NextResponse.json(
      { error: "Muitas gerações seguidas. Aguarde um instante." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const prompt: string = (body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt vazio." }, { status: 400 });

  // Debita 1 crédito antes de chamar a IA
  const debit = await debitCredits(session.org, 1, "carousel_generate");
  if (!debit.ok) {
    return NextResponse.json(
      { error: "Saldo insuficiente. Adquira mais créditos." },
      { status: 402 },
    );
  }

  // Cria a campanha em draft
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: session.org,
      prompt,
      status: "rendering",
    },
  });

  // Chama a IA para gerar o conteúdo
  let content;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.org },
      select: { name: true, niche: true, brandKit: true },
    });
    content = await generateCarousel({
      prompt,
      niche: org?.niche ?? "outro",
      orgName: org?.name ?? session.name,
      orgKit: org?.brandKit
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
    });
  } catch (err) {
    // Estorna crédito se a IA falhar
    await refundCredits(session.org, 1, "carousel_refund", campaign.id);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "error", errorMsg: String((err as Error).message ?? err) },
    });
    return NextResponse.json({ error: "Falha ao gerar conteúdo com IA." }, { status: 500 });
  }

  // Salva os slides no banco
  await prisma.campaignSlide.createMany({
    data: content.slides.map((s) => ({
      campaignId: campaign.id,
      index: s.index,
      layout: s.layout,
      headline: s.headline,
      body: s.body,
      bullets: s.bullets?.map((b) => `${b.icon} ${b.label}: ${b.desc}`) ?? [],
    })),
  });

  // Retorna preview imediato e renderiza em background
  void renderInBackground(campaign.id, content.slides, content.brand);

  return NextResponse.json({
    campaignId: campaign.id,
    status: "rendering",
    slides: content.slides,
    brand: content.brand,
  });
}

async function renderInBackground(
  campaignId: string,
  slides: Parameters<typeof renderCarouselToPNGs>[1],
  brand: Parameters<typeof renderCarouselToPNGs>[2],
) {
  try {
    const result = await renderCarouselToPNGs(campaignId, slides, brand);
    // Atualiza imageUrl de cada slide
    for (let i = 0; i < result.slidePaths.length; i++) {
      await prisma.campaignSlide.updateMany({
        where: { campaignId, index: i },
        data: { imageUrl: result.slidePaths[i] },
      });
    }
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ready" },
    });
  } catch (err) {
    console.error("[marketing:render] falhou:", err);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "error",
        errorMsg: String((err as Error).message ?? err),
      },
    });
  }
}
