"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { markOrderSentAction } from "@/app/espaco/[slug]/m/purchasing-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ShareData {
  slug: string;
  orderId: string;
  code: string;
  orgName: string;
  supplierName: string;
  phone: string;
  email: string;
  items: { name: string; quantity: number; unitCost: number }[];
  total: number;
  note: string;
  sentAt: string | null;
}

function buildMessage(d: ShareData): string {
  const linhas = d.items
    .map((it) => `• ${it.quantity}x ${it.name} — ${brl(it.unitCost)}`)
    .join("\n");
  return (
    `Pedido de compra ${d.code} — ${d.orgName}\n\n` +
    `Fornecedor: ${d.supplierName}\n\n` +
    `${linhas}\n\n` +
    `Total: ${brl(d.total)}` +
    (d.note ? `\n\nObs.: ${d.note}` : "") +
    `\n\nPor favor, confirmar disponibilidade e prazo de entrega.`
  );
}

export default function PedidoShare({ data }: { data: ShareData }) {
  const [sentAt, setSentAt] = useState(data.sentAt);
  const msg = buildMessage(data);
  const waPhone = data.phone.replace(/\D/g, "");
  const waLink = `https://wa.me/${waPhone.length >= 12 ? waPhone : "55" + waPhone}?text=${encodeURIComponent(msg)}`;
  const mailLink = `mailto:${data.email}?subject=${encodeURIComponent(
    `Pedido de compra ${data.code} — ${data.orgName}`,
  )}&body=${encodeURIComponent(msg)}`;

  async function share(via: "whatsapp" | "email", url: string) {
    window.open(url, "_blank");
    const res = await markOrderSentAction(data.orderId, via);
    if (res.ok)
      setSentAt(
        new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
  }

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[640px] flex-wrap items-center gap-2 print:hidden">
      <Link
        href={`/espaco/${data.slug}/m/fornecedores`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {sentAt && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Enviado em {sentAt}
        </span>
      )}

      <div className="ml-auto flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
        >
          <Printer className="h-4 w-4" />
          PDF
        </button>
        {data.email && (
          <button
            onClick={() => share("email", mailLink)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Mail className="h-4 w-4" />
            E-mail
          </button>
        )}
        {waPhone && (
          <button
            onClick={() => share("whatsapp", waLink)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}
