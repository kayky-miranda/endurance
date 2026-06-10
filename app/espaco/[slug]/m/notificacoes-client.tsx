"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Wallet,
  Users,
  Bell,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

type NotifType = "estoque" | "financeiro" | "clientes";
type NotifItem = {
  id: string;
  type: NotifType;
  severity: "danger" | "warn" | "info";
  title: string;
  message: string;
  phone?: string;
  suggestion?: string;
};

const TYPE_META: Record<NotifType, { label: string; icon: typeof Bell }> = {
  estoque: { label: "Estoque", icon: Boxes },
  financeiro: { label: "Financeiro", icon: Wallet },
  clientes: { label: "Clientes", icon: Users },
};

export default function NotificacoesClient({
  items,
  counts,
}: {
  items: NotifItem[];
  counts: Record<NotifType, number>;
}) {
  const [filter, setFilter] = useState<"all" | NotifType>("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  function waLink(phone: string, text: string) {
    const digits = phone.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-5">
      {/* Resumo por categoria */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          type="estoque"
          count={counts.estoque}
          active={filter === "estoque"}
          onClick={() => setFilter(filter === "estoque" ? "all" : "estoque")}
        />
        <SummaryCard
          type="financeiro"
          count={counts.financeiro}
          active={filter === "financeiro"}
          onClick={() => setFilter(filter === "financeiro" ? "all" : "financeiro")}
        />
        <SummaryCard
          type="clientes"
          count={counts.clientes}
          active={filter === "clientes"}
          onClick={() => setFilter(filter === "clientes" ? "all" : "clientes")}
        />
      </div>

      {filter !== "all" && (
        <button
          onClick={() => setFilter("all")}
          className="text-xs font-medium text-brand-600 hover:text-brand-500 dark:text-brand-300"
        >
          ← Ver todas as notificações
        </button>
      )}

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center dark:border-ink-700">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Bell className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            Tudo em ordem!
          </p>
          <p className="text-xs text-slate-500">
            Nenhum alerta pendente nesta categoria.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => {
            const Meta = TYPE_META[n.type];
            const tone =
              n.severity === "danger"
                ? "border-red-500/30 bg-red-500/5"
                : n.severity === "warn"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-900";
            const iconTone =
              n.severity === "danger"
                ? "bg-red-500/15 text-red-500"
                : n.severity === "warn"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-brand-500/15 text-brand-500";
            return (
              <div
                key={n.id}
                className={`flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 ${tone}`}
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>
                  {n.severity === "danger" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Meta.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                </div>
                {n.phone && n.suggestion && (
                  <a
                    href={waLink(n.phone, n.suggestion)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  type,
  count,
  active,
  onClick,
}: {
  type: NotifType;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const Meta = TYPE_META[type];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
        active
          ? "border-brand-500 bg-brand-500/5"
          : "border-slate-200 bg-white hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900"
      }`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-500">
        <Meta.icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{count}</p>
        <p className="text-xs text-slate-500">{Meta.label}</p>
      </div>
    </button>
  );
}
