import { NextResponse } from "next/server";
import { classifyBusiness } from "@/lib/endurance/onboarding";
import { hit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Usa o SDK da Anthropic (Node) e lê env em runtime — força Node + dinâmico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Endpoint público que dispara chamada paga à IA — limita por IP.
  const ip = await clientIp();
  if (!(await hit(`ai:onboarding:${ip}`, 20, 60_000)).ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante." },
      { status: 429 },
    );
  }

  let description = "";
  try {
    const body = await request.json();
    description = typeof body?.description === "string" ? body.description : "";
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido. Envie JSON { description }." },
      { status: 400 },
    );
  }

  if (!description.trim()) {
    return NextResponse.json(
      { error: "Descreva o negócio em 'description'." },
      { status: 400 },
    );
  }

  try {
    const result = await classifyBusiness(description);
    return NextResponse.json(result);
  } catch (err) {
    logger.exception("Falha ao classificar o negócio", err);
    return NextResponse.json(
      { error: "Falha ao classificar o negócio." },
      { status: 500 },
    );
  }
}
