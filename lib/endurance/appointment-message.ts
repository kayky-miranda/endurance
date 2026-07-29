/**
 * Mensagem de confirmação de consulta + link wa.me (PURO — sem "server-only",
 * importável de client e server e testável isoladamente). NÃO envia nada: monta
 * o texto e a URL para um handoff de 1 clique pelo WhatsApp do próprio
 * profissional/recepção (sem credencial de API).
 */

export interface ConfirmationMessageInput {
  orgName: string;
  customerName: string;
  service?: string;
  /** Data já formatada, ex.: "quinta, 30/07". */
  dateLabel: string;
  /** Hora já formatada, ex.: "14:30". */
  timeLabel: string;
  professional?: string;
}

export function buildConfirmationMessage(i: ConfirmationMessageInput): string {
  const first = (i.customerName || "").trim().split(/\s+/)[0] || "";
  const saud = first ? `Olá, ${first}! ` : "Olá! ";
  const detalhes = [
    `📅 ${i.dateLabel} às ${i.timeLabel}`,
    i.service ? `🩺 ${i.service}` : "",
    i.professional ? `👤 ${i.professional}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    `${saud}Passando para confirmar seu atendimento em ${i.orgName}:\n\n` +
    `${detalhes}\n\n` +
    `Podemos confirmar sua presença? Se precisar remarcar, é só responder por aqui. 🙂`
  );
}

/** Normaliza o telefone e monta a URL wa.me (assume Brasil se faltar DDI). */
export function waLink(phone: string, text: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null; // sem DDD+número não dá para discar
  const withCountry = digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}
