"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Boxes,
  Wallet,
  Users,
  Bell,
  MessageCircle,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { sendWhatsAppAction } from "./whatsapp-actions";
import {
  savePixConfigAction,
  saveWhatsAppConfigAction,
} from "./integracoes-actions";
import type { PixConfigView } from "@/lib/endurance/pix-service";
import type { WhatsAppConfigView } from "@/lib/endurance/whatsapp-service";

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

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function NotificacoesClient({
  items,
  counts,
  pixConfig,
  whatsappConfig,
}: {
  items: NotifItem[];
  counts: Record<NotifType, number>;
  pixConfig: PixConfigView | null;
  whatsappConfig: WhatsAppConfigView | null;
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
      {pixConfig && whatsappConfig && (
        <IntegrationsPanel pix={pixConfig} whatsapp={whatsappConfig} />
      )}

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
                  <div className="flex shrink-0 items-center gap-1.5">
                    <WhatsAppSend phone={n.phone} text={n.suggestion} />
                    <a
                      href={waLink(n.phone, n.suggestion)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir conversa no WhatsApp"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
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

/** Botão de envio via WhatsApp Business API (registra e, no modo real, envia). */
function WhatsAppSend({ phone, text }: { phone: string; text: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    null | { ok: boolean; simulated?: boolean; error?: string }
  >(null);

  function send() {
    setResult(null);
    start(async () => {
      const res = await sendWhatsAppAction({
        toPhone: phone,
        body: text,
        kind: "crm",
      });
      setResult({ ok: res.ok, simulated: res.simulated, error: res.error });
    });
  }

  if (result?.ok)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {result.simulated ? "Registrado" : "Enviado"}
      </span>
    );

  return (
    <button
      onClick={send}
      disabled={pending}
      title={result?.error ?? "Enviar pelo WhatsApp"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 ${
        result?.error ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"
      }`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      {result?.error ? "Tentar de novo" : "Enviar"}
    </button>
  );
}

/** Painel de configuração das integrações PIX e WhatsApp (não-secretos). */
function IntegrationsPanel({
  pix,
  whatsapp,
}: {
  pix: PixConfigView;
  whatsapp: WhatsAppConfigView;
}) {
  const [open, setOpen] = useState(false);

  // PIX
  const [pixProvider, setPixProvider] = useState(pix.provider);
  const [pixKey, setPixKey] = useState(pix.pixKey);
  const [pixNome, setPixNome] = useState(pix.beneficiario);
  const [pixCidade, setPixCidade] = useState(pix.cidade);
  const [pixSaving, pixStart] = useTransition();
  const [pixOk, setPixOk] = useState(false);

  // WhatsApp
  const [waProvider, setWaProvider] = useState(whatsapp.provider);
  const [waPhoneId, setWaPhoneId] = useState(whatsapp.phoneNumberId);
  const [waRemetente, setWaRemetente] = useState(whatsapp.remetente);
  const [waEnabled, setWaEnabled] = useState(whatsapp.enabled);
  const [waSaving, waStart] = useTransition();
  const [waOk, setWaOk] = useState(false);

  function savePix() {
    setPixOk(false);
    pixStart(async () => {
      const res = await savePixConfigAction({
        provider: pixProvider,
        pixKey,
        beneficiario: pixNome,
        cidade: pixCidade,
      });
      setPixOk(res.ok);
    });
  }
  function saveWa() {
    setWaOk(false);
    waStart(async () => {
      const res = await saveWhatsAppConfigAction({
        provider: waProvider,
        phoneNumberId: waPhoneId,
        remetente: waRemetente,
        enabled: waEnabled,
      });
      setWaOk(res.ok);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Settings className="h-4 w-4 text-brand-500" />
          Integrações (PIX e WhatsApp)
        </span>
        <span className="text-xs text-slate-400">{open ? "ocultar" : "configurar"}</span>
      </button>

      {open && (
        <div className="grid gap-5 border-t border-slate-100 p-5 dark:border-ink-800 sm:grid-cols-2">
          {/* PIX */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cobrança PIX
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Modo</span>
              <select
                value={pixProvider}
                onChange={(e) => setPixProvider(e.target.value)}
                className={inputCls}
              >
                <option value="">Simulado (BR Code da chave)</option>
                <option value="mercadopago">Mercado Pago (real)</option>
              </select>
            </label>
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Chave PIX do recebedor"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={pixNome}
                onChange={(e) => setPixNome(e.target.value)}
                placeholder="Beneficiário"
                className={inputCls}
              />
              <input
                value={pixCidade}
                onChange={(e) => setPixCidade(e.target.value)}
                placeholder="Cidade"
                className={inputCls}
              />
            </div>
            <button
              onClick={savePix}
              disabled={pixSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {pixSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {pixOk ? "Salvo!" : "Salvar PIX"}
            </button>
          </div>

          {/* WhatsApp */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              WhatsApp Business
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Modo</span>
              <select
                value={waProvider}
                onChange={(e) => setWaProvider(e.target.value)}
                className={inputCls}
              >
                <option value="">Simulado (só registra)</option>
                <option value="meta">Meta Cloud API (real)</option>
              </select>
            </label>
            <input
              value={waPhoneId}
              onChange={(e) => setWaPhoneId(e.target.value)}
              placeholder="Phone Number ID"
              className={inputCls}
            />
            <input
              value={waRemetente}
              onChange={(e) => setWaRemetente(e.target.value)}
              placeholder="Remetente (exibição)"
              className={inputCls}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={waEnabled}
                onChange={(e) => setWaEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              Envio ativo
            </label>
            <button
              onClick={saveWa}
              disabled={waSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {waSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {waOk ? "Salvo!" : "Salvar WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
