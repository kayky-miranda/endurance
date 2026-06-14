"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  emitNfceAction,
  cancelNfceAction,
  saveFiscalConfigAction,
  type FiscalConfigInput,
} from "./fiscal-actions";
import type { NfceRow, FiscalConfigView } from "@/lib/endurance/fiscal-service";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS: Record<
  NfceRow["status"],
  { label: string; cls: string; icon: typeof Clock }
> = {
  autorizada: {
    label: "Autorizada",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  cancelada: {
    label: "Cancelada",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
    icon: XCircle,
  },
  pendente: {
    label: "Pendente",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: Clock,
  },
};

export default function FiscalClient({
  slug,
  rows,
  config,
}: {
  slug: string;
  rows: NfceRow[];
  config: FiscalConfigView;
}) {
  const router = useRouter();
  const [showConfig, setShowConfig] = useState(!config.configured);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function emit(saleId: string) {
    setBusy(saleId);
    setError(null);
    const res = await emitNfceAction(saleId);
    setBusy(null);
    if (res.ok) {
      router.push(`/espaco/${slug}/nfce/${res.docId}`);
    } else {
      setError(res.error);
    }
  }

  async function cancel(docId: string) {
    const motivo = window.prompt(
      "Justificativa do cancelamento (mínimo 15 caracteres):",
    );
    if (motivo === null) return;
    setBusy(docId);
    setError(null);
    const res = await cancelNfceAction(docId, motivo);
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Falha ao cancelar.");
  }

  return (
    <div className="space-y-5">
      {!config.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Dados fiscais incompletos</p>
            <p className="mt-0.5 text-amber-700/80 dark:text-amber-300/80">
              Informe CNPJ, razão social e credenciais do CSC para emitir NFC-e.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ambiente:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {config.ambiente === "1" ? "Produção" : "Homologação"}
          </span>{" "}
          · Série {config.serie} · Próximo nº {config.proxNumero}
        </p>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
        >
          <Settings className="h-4 w-4" />
          Configuração fiscal
        </button>
      </div>

      {showConfig && (
        <ConfigForm
          config={config}
          onSaved={() => {
            setShowConfig(false);
            router.refresh();
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Vendas recentes
          <span className="ml-2 font-normal text-slate-400">
            emita a NFC-e (modelo 65) de cada venda
          </span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                <th className="px-5 py-2.5 font-medium">Venda</th>
                <th className="px-5 py-2.5 font-medium">Cliente</th>
                <th className="px-5 py-2.5 font-medium">Total</th>
                <th className="px-5 py-2.5 font-medium">NFC-e</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const st = STATUS[r.status];
                const Icon = st.icon;
                const loading =
                  busy !== null && (busy === r.saleId || busy === r.docId);
                return (
                  <tr
                    key={r.saleId}
                    className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                  >
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      <span className="block font-medium text-slate-700 dark:text-slate-200">
                        #{r.saleId.slice(-6).toUpperCase()}
                      </span>
                      {r.quando}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {r.cliente}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {brl(r.total)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {r.numero ? `nº ${r.numero}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {r.docId && (
                          <Link
                            href={`/espaco/${slug}/nfce/${r.docId}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            DANFE
                          </Link>
                        )}
                        {r.status === "pendente" && (
                          <button
                            onClick={() => emit(r.saleId)}
                            disabled={loading || !config.configured}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
                          >
                            {loading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            Emitir
                          </button>
                        )}
                        {r.status === "autorizada" && r.docId && (
                          <button
                            onClick={() => cancel(r.docId!)}
                            disabled={loading}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500 transition hover:bg-red-500/10 disabled:opacity-40 dark:border-red-500/30"
                          >
                            {loading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfigForm({
  config,
  onSaved,
}: {
  config: FiscalConfigView;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FiscalConfigInput>({
    cnpj: config.cnpj,
    razaoSocial: config.razaoSocial,
    nomeFantasia: config.nomeFantasia,
    ie: config.ie,
    crt: config.crt,
    uf: config.uf,
    municipio: config.municipio,
    cMun: config.cMun,
    serie: config.serie,
    ambiente: config.ambiente,
    cscId: config.cscId,
    csc: config.csc,
    provider: config.provider,
    defaultNcm: config.defaultNcm,
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof FiscalConfigInput>(
    k: K,
    v: FiscalConfigInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setErr(null);
    start(async () => {
      const res = await saveFiscalConfigAction(form);
      if (res.ok) onSaved();
      else setErr(res.error ?? "Falha ao salvar.");
    });
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Settings className="h-4 w-4 text-brand-500" />
        Dados do emitente (NFC-e)
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CNPJ">
          <input
            value={form.cnpj}
            onChange={(e) => set("cnpj", e.target.value)}
            placeholder="00.000.000/0000-00"
            className={inputCls}
          />
        </Field>
        <Field label="Inscrição estadual">
          <input value={form.ie} onChange={(e) => set("ie", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Razão social">
          <input
            value={form.razaoSocial}
            onChange={(e) => set("razaoSocial", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Nome fantasia">
          <input
            value={form.nomeFantasia}
            onChange={(e) => set("nomeFantasia", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Município">
          <input
            value={form.municipio}
            onChange={(e) => set("municipio", e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="UF">
            <input
              value={form.uf}
              onChange={(e) => set("uf", e.target.value)}
              maxLength={2}
              className={inputCls}
            />
          </Field>
          <Field label="Cód. IBGE munic.">
            <input
              value={form.cMun}
              onChange={(e) => set("cMun", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Regime tributário">
          <select
            value={form.crt}
            onChange={(e) => set("crt", e.target.value)}
            className={inputCls}
          >
            <option value="1">Simples Nacional</option>
            <option value="3">Regime Normal</option>
          </select>
        </Field>
        <Field label="Ambiente">
          <select
            value={form.ambiente}
            onChange={(e) => set("ambiente", e.target.value)}
            className={inputCls}
          >
            <option value="2">Homologação</option>
            <option value="1">Produção</option>
          </select>
        </Field>
        <Field label="Série">
          <input
            type="number"
            value={form.serie}
            onChange={(e) => set("serie", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="ID do CSC">
          <input
            value={form.cscId}
            onChange={(e) => set("cscId", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="CSC (token)">
          <input
            value={form.csc}
            onChange={(e) => set("csc", e.target.value)}
            placeholder="Código de Segurança do Contribuinte"
            className={inputCls}
          />
        </Field>
        <Field label="Emissão">
          <select
            value={form.provider}
            onChange={(e) => set("provider", e.target.value)}
            className={inputCls}
          >
            <option value="">Simulada (protótipo)</option>
            <option value="focusnfe">Real · Focus NFe</option>
          </select>
        </Field>
        <Field label="NCM padrão dos produtos">
          <input
            value={form.defaultNcm}
            onChange={(e) => set("defaultNcm", e.target.value)}
            maxLength={8}
            placeholder="8 dígitos (ex.: 22021000)"
            className={inputCls}
          />
        </Field>
      </div>

      {form.provider === "focusnfe" && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Emissão real via Focus NFe. Em <strong>Homologação</strong> as notas
          não têm valor fiscal. A produção exige certificado A1 cadastrado no
          provedor e liberação no servidor — só ligue após validar em
          homologação.
        </p>
      )}

      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar dados fiscais
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
