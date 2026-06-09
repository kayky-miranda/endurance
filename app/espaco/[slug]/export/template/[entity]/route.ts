import { NextResponse } from "next/server";
import { getSession, canManageTeam } from "@/lib/auth";
import { importSpec } from "@/lib/endurance/import-spec";

const cell = (v: string) =>
  /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; entity: string }> },
) {
  const { slug, entity } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!canManageTeam(session.role))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const spec = importSpec(entity);
  if (!spec || !spec.available)
    return new NextResponse("Modelo indisponível.", { status: 404 });

  const header = spec.columns.map((c) => c.label);
  const example = spec.columns.map((c) => c.example);
  const csv =
    "﻿" + [header.map(cell).join(";"), example.map(cell).join(";")].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modelo-${entity}.csv"`,
    },
  });
}
