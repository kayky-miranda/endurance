import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: session.org },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      slides: {
        orderBy: { index: "asc" },
        select: { index: true, imageUrl: true, headline: true, layout: true },
      },
    },
  });

  return NextResponse.json({ campaigns });
}
