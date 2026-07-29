/**
 * Geração de iCalendar (.ics) — PURO, sem "server-only": importável de client e
 * server e testável isoladamente. Formato RFC 5545, aceito por Google Agenda,
 * Outlook e Apple Calendário. É um arquivo REAL e padrão (não é integração
 * simulada): o profissional/paciente importa o evento no próprio calendário.
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  durationMin: number;
  summary: string;
  description?: string;
  location?: string;
  /** Momento de geração (default: agora) — vira o DTSTAMP. */
  stamp?: Date;
}

/** Escapa texto para um valor de propriedade iCalendar (RFC 5545 §3.3.11). */
function escapeText(v: string): string {
  return (v || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Data/hora em UTC no formato compacto: YYYYMMDDTHHMMSSZ. */
function toUtcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Dobra linhas longas em 75 octetos (RFC 5545 §3.1), continuação com espaço. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildIcs(event: IcsEvent): string {
  const dur = Number.isFinite(event.durationMin) ? Math.max(1, event.durationMin) : 30;
  const end = new Date(event.start.getTime() + dur * 60_000);
  const stamp = event.stamp ?? new Date();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ENDURANCE//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${toUtcStamp(stamp)}`,
    `DTSTART:${toUtcStamp(event.start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF entre linhas (RFC 5545) + dobra de linhas longas.
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Nome de arquivo seguro para o .ics a partir de um rótulo livre. */
export function icsFilename(label: string): string {
  const slug = (label || "atendimento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "atendimento";
  return `${slug}.ics`;
}
