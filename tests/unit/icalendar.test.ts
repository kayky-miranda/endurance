import { describe, it, expect } from "vitest";
import { buildIcs, icsFilename } from "@/lib/endurance/icalendar";

describe("buildIcs", () => {
  const base = {
    uid: "appt-123@endurance",
    start: new Date(Date.UTC(2026, 6, 30, 17, 30, 0)), // 30/07/2026 17:30 UTC
    durationMin: 30,
    summary: "Consulta — Maria",
    stamp: new Date(Date.UTC(2026, 6, 28, 12, 0, 0)),
  };

  it("gera um VCALENDAR/VEVENT válido com DTSTART/DTEND em UTC", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:appt-123@endurance");
    expect(ics).toContain("DTSTART:20260730T173000Z");
    expect(ics).toContain("DTEND:20260730T180000Z"); // +30min
    expect(ics).toContain("DTSTAMP:20260728T120000Z");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
    // Usa CRLF entre linhas.
    expect(ics).toContain("\r\n");
  });

  it("escapa vírgula, ponto-e-vírgula e quebra de linha", () => {
    const ics = buildIcs({
      ...base,
      summary: "Retorno; controle, revisão",
      description: "linha1\nlinha2",
    });
    expect(ics).toContain("SUMMARY:Retorno\\; controle\\, revisão");
    expect(ics).toContain("DESCRIPTION:linha1\\nlinha2");
  });

  it("omite DESCRIPTION/LOCATION quando ausentes", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("duração inválida cai para 30 min", () => {
    const ics = buildIcs({ ...base, durationMin: NaN as unknown as number });
    expect(ics).toContain("DTEND:20260730T180000Z");
  });
});

describe("icsFilename", () => {
  it("normaliza acentos e caracteres para um slug .ics", () => {
    expect(icsFilename("Consulta — João Coração")).toBe("consulta-joao-coracao.ics");
  });
  it("usa fallback quando vazio", () => {
    expect(icsFilename("")).toBe("atendimento.ics");
  });
});
