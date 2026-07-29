import { NextResponse } from "next/server";
import { getSession, sessionHasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/endurance/workspace";
import { buildIcs, icsFilename } from "@/lib/endurance/icalendar";

/**
 * Exporta um atendimento como arquivo .ics (iCalendar) para importar no Google
 * Agenda, Outlook ou Apple Calendário. Escopo por org + permissão agenda.manage.
 * Arquivo-padrão real (RFC 5545) — não é integração simulada.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; appointmentId: string }> },
) {
  const { slug, appointmentId } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug)
    return new NextResponse("Não autorizado.", { status: 401 });
  if (!sessionHasPermission(session, "agenda.manage"))
    return new NextResponse("Acesso restrito.", { status: 403 });

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: session.org },
    select: {
      id: true,
      customerName: true,
      service: true,
      professional: true,
      startsAt: true,
      durationMin: true,
      notes: true,
    },
  });
  if (!appt) return new NextResponse("Atendimento não encontrado.", { status: 404 });

  const ws = await getWorkspace(slug);
  const who = appt.customerName || "Paciente";
  const summary = [appt.service || "Atendimento", who].filter(Boolean).join(" — ");
  const description = [
    appt.professional ? `Profissional: ${appt.professional}` : "",
    ws?.name ? `Local: ${ws.name}` : "",
    appt.notes ? `Obs.: ${appt.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const ics = buildIcs({
    uid: `${appt.id}@endurance-${slug}`,
    start: appt.startsAt,
    durationMin: appt.durationMin,
    summary,
    description: description || undefined,
    location: ws?.name || undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(who)}"`,
    },
  });
}
