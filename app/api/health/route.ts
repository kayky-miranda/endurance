import { NextResponse } from "next/server";
import { getHealthReport } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check para uptime externo. Retorna 200 se o app + banco estão de pé,
 * 503 se algum dependente crítico caiu. A lógica vive em lib/health.ts e é
 * compartilhada com a página pública /status.
 */
export async function GET() {
  const start = Date.now();
  const report = await getHealthReport();
  const db = report.checks.find((c) => c.key === "database");

  return NextResponse.json(
    {
      status: report.ok ? "ok" : "degraded",
      db: { ok: db?.level === "ok", latencyMs: db?.latencyMs ?? -1 },
      uptimeSec: report.uptimeSec,
      version: report.version,
      responseMs: Date.now() - start,
    },
    {
      status: report.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
