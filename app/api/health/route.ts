import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check para uptime externo. Retorna 200 se o app + banco estão de pé,
 * 503 se algum dependente caiu. Inclui ping leve no Postgres (~5ms).
 */
export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatency = -1;

  try {
    const t = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - t;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: { ok: dbOk, latencyMs: dbLatency },
      uptimeSec: Math.floor(process.uptime()),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      responseMs: Date.now() - start,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
