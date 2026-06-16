import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: session.org },
    include: {
      slides: { orderBy: { index: "asc" } },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ campaign });
}
