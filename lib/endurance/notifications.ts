import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { getStockAlerts } from "./stock-alerts";
import { getCustomerInsights } from "./crm";

export type NotifType = "estoque" | "financeiro" | "clientes";

export interface NotifItem {
  id: string;
  type: NotifType;
  severity: "danger" | "warn" | "info";
  title: string;
  message: string;
  /** Telefone do cliente (para link de WhatsApp), quando aplicável. */
  phone?: string;
  /** Mensagem pronta para envio (WhatsApp/e-mail). */
  suggestion?: string;
}

export interface NotificationsData {
  items: NotifItem[];
  counts: Record<NotifType, number>;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Central de notificações: cruza estoque, financeiro e CRM para gerar alertas
 * acionáveis (automações por regra). Cada item já vem com uma mensagem pronta
 * para enviar por WhatsApp/e-mail.
 */
export async function getNotifications(org: string): Promise<NotificationsData> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const [alerts, finance, crm, orgRow] = await Promise.all([
    getStockAlerts(org, 14),
    prisma.financialEntry.findMany({
      where: { organizationId: org, status: "pendente", dueDate: { lte: today } },
      orderBy: { dueDate: "asc" },
    }),
    getCustomerInsights(org),
    prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
  ]);
  const negocio = orgRow?.name ?? "nosso estabelecimento";

  const items: NotifItem[] = [];

  // --- Estoque ---
  for (const a of alerts) {
    if (a.level === "atencao" && a.stock > 5) continue;
    const rompido = a.level === "rompido";
    items.push({
      id: `estoque-${a.id}`,
      type: "estoque",
      severity: rompido || a.level === "critico" ? "danger" : "warn",
      title: rompido ? `Sem estoque: ${a.name}` : `Estoque baixo: ${a.name}`,
      message: rompido
        ? `Produto zerado. Repor cerca de ${a.suggestedReorder} unidades.`
        : `${a.stock} un em estoque${a.daysLeft != null ? ` (~${a.daysLeft} dias)` : ""}. Repor ~${a.suggestedReorder} un.`,
    });
  }

  // --- Financeiro ---
  for (const e of finance) {
    const venc = e.dueDate.toLocaleDateString("pt-BR");
    const atrasada = e.dueDate < new Date(new Date().setHours(0, 0, 0, 0));
    items.push({
      id: `fin-${e.id}`,
      type: "financeiro",
      severity: atrasada ? "danger" : "warn",
      title: `${e.kind === "pagar" ? "Conta a pagar" : "Recebível"} ${atrasada ? "vencido" : "vence hoje"}`,
      message: `${e.description} · ${brl(money(e.amount))} · vencimento ${venc}.`,
    });
  }

  // --- Clientes a recomprar ---
  for (const c of crm.dueTop) {
    items.push({
      id: `cli-${c.id}`,
      type: "clientes",
      severity: "info",
      title: `${c.name} pronto para recomprar`,
      message: `Última compra há ${c.lastDays ?? "?"} dias · ticket médio ${brl(c.avgTicket)}.`,
      phone: c.phone || undefined,
      suggestion: `Olá, ${c.name}! Aqui é do ${negocio}. Sentimos sua falta — temos novidades e ofertas esperando por você. Posso te ajudar com um novo pedido?`,
    });
  }

  const counts: Record<NotifType, number> = {
    estoque: items.filter((i) => i.type === "estoque").length,
    financeiro: items.filter((i) => i.type === "financeiro").length,
    clientes: items.filter((i) => i.type === "clientes").length,
  };

  return { items, counts };
}
