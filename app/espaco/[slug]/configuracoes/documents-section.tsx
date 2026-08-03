"use client";

import { useRef, useState, useTransition } from "react";
import {
  FileSignature,
  Loader2,
  Check,
  AlertCircle,
  Upload,
  Trash2,
} from "lucide-react";
import type {
  DocumentSettingsView,
  SignatureBlock,
} from "@/lib/endurance/document-letterhead";
import {
  saveDocumentSettingsAction,
  saveSignatureAction,
} from "./documents-actions";

/**
 * Papel timbrado dos documentos impressos + assinatura do profissional.
 *
 * A pré-visualização à direita reproduz o cabeçalho real e muda enquanto o
 * usuário digita: configurar timbre às cegas e só descobrir o resultado ao
 * imprimir seria o pior fluxo possível.
 */

const MAX_SIGNATURE_BYTES = 200 * 1024;

export default function DocumentsSection({
  settings,
  signature,
  canEditLetterhead,
}: {
  settings: DocumentSettingsView;
  signature: SignatureBlock;
  /** Timbre é da clínica; sem `settings.general` o profissional só edita a assinatura. */
  canEditLetterhead: boolean;
}) {
  const [cfg, setCfg] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function set<K extends keyof DocumentSettingsView>(
    key: K,
    value: DocumentSettingsView[K],
  ) {
    setCfg((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError("");
    startTransition(async () => {
      const res = await saveDocumentSettingsAction({
        displayName: cfg.displayName,
        address: cfg.address,
        phone: cfg.phone,
        email: cfg.email,
        website: cfg.website,
        headerNote: cfg.headerNote,
        footerText: cfg.footerText,
        showLogo: cfg.showLogo,
        showCnpj: cfg.showCnpj,
        accentColor: cfg.accentColor,
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else setError(res.error);
    });
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:opacity-60 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <FileSignature className="h-4 w-4 text-brand-500" /> Documentos impressos
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Cabeçalho, rodapé e assinatura usados em receitas, atestados, laudos,
        declarações e relatórios. O logo é o mesmo da aparência do espaço.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Nome exibido
            <input
              value={cfg.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              placeholder={cfg.orgName}
              disabled={!canEditLetterhead}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Linha de destaque
            <input
              value={cfg.headerNote}
              onChange={(e) => set("headerNote", e.target.value)}
              placeholder="Ex.: Nutrição clínica e esportiva"
              disabled={!canEditLetterhead}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Endereço
            <input
              value={cfg.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Rua, número — Cidade/UF"
              disabled={!canEditLetterhead}
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Telefone
              <input
                value={cfg.phone}
                onChange={(e) => set("phone", e.target.value)}
                disabled={!canEditLetterhead}
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              E-mail
              <input
                value={cfg.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={!canEditLetterhead}
                className={inputCls}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Site
              <input
                value={cfg.website}
                onChange={(e) => set("website", e.target.value)}
                disabled={!canEditLetterhead}
                className={inputCls}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Cor de destaque
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  disabled={!canEditLetterhead}
                  aria-label="Cor de destaque do timbre"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent disabled:opacity-60 dark:border-ink-600"
                />
                <span className="text-xs text-slate-400">{cfg.accentColor}</span>
              </span>
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Rodapé
            <textarea
              value={cfg.footerText}
              onChange={(e) => set("footerText", e.target.value)}
              rows={2}
              placeholder="Ex.: Documento emitido eletronicamente."
              disabled={!canEditLetterhead}
              className={`${inputCls} resize-none`}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={cfg.showLogo}
                onChange={(e) => set("showLogo", e.target.checked)}
                disabled={!canEditLetterhead}
                className="h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              Mostrar logo
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={cfg.showCnpj}
                onChange={(e) => set("showCnpj", e.target.checked)}
                disabled={!canEditLetterhead}
                className="h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              Mostrar CNPJ
            </label>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          {canEditLetterhead && (
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved && <Check className="h-4 w-4" />}
              {saved ? "Salvo" : "Salvar timbre"}
            </button>
          )}
          {!canEditLetterhead && (
            <p className="text-[11px] text-slate-400">
              Só quem administra o espaço edita o timbre. Sua assinatura, ao
              lado, você mesmo gerencia.
            </p>
          )}
        </div>

        {/* Pré-visualização + assinatura */}
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Pré-visualização do cabeçalho
            </span>
            <LetterheadPreview cfg={cfg} />
          </div>
          <SignatureBox signature={signature} />
        </div>
      </div>
    </section>
  );
}

function LetterheadPreview({ cfg }: { cfg: DocumentSettingsView }) {
  const contact = [cfg.phone, cfg.email, cfg.website].filter(Boolean).join(" · ");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-ink-700">
      <div
        className="flex items-center gap-3 border-b-2 pb-2"
        style={{ borderColor: cfg.accentColor }}
      >
        {cfg.showLogo && cfg.logoDataUrl && (
          /* eslint-disable-next-line @next/next/no-img-element -- data URL */
          <img src={cfg.logoDataUrl} alt="" className="max-h-10 max-w-[80px] object-contain" />
        )}
        <div className="min-w-0">
          <p
            className="truncate text-sm font-bold"
            style={{ color: cfg.accentColor }}
          >
            {cfg.displayName || cfg.orgName || "Nome da clínica"}
          </p>
          {cfg.headerNote && (
            <p className="truncate text-[10px] italic text-slate-500">{cfg.headerNote}</p>
          )}
          {cfg.address && <p className="truncate text-[10px] text-slate-500">{cfg.address}</p>}
          {contact && <p className="truncate text-[10px] text-slate-500">{contact}</p>}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
        Atestado médico
      </p>
      <div className="mt-2 space-y-1">
        <div className="h-1.5 w-full rounded bg-slate-100 dark:bg-ink-800" />
        <div className="h-1.5 w-11/12 rounded bg-slate-100 dark:bg-ink-800" />
        <div className="h-1.5 w-9/12 rounded bg-slate-100 dark:bg-ink-800" />
      </div>
      {cfg.footerText && (
        <p className="mt-3 border-t border-slate-100 pt-1.5 text-center text-[9px] text-slate-400 dark:border-ink-800">
          {cfg.footerText}
        </p>
      )}
    </div>
  );
}

function SignatureBox({ signature }: { signature: SignatureBlock }) {
  const [current, setCurrent] = useState(signature.signatureDataUrl);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function persist(dataUrl: string | null) {
    setError("");
    startTransition(async () => {
      const res = await saveSignatureAction(dataUrl);
      if (res.ok) setCurrent(dataUrl);
      else setError(res.error);
    });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo depois
    if (!file) return;
    setError("");
    if (file.size > MAX_SIGNATURE_BYTES) {
      setError("Imagem muito grande (máx. 200 KB). Use um PNG recortado.");
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Envie uma imagem PNG, JPEG ou WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Não foi possível ler o arquivo.");
    reader.onload = () => persist(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        Sua assinatura
      </span>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-ink-700 dark:bg-ink-900">
        {current ? (
          /* eslint-disable-next-line @next/next/no-img-element -- data URL */
          <img src={current} alt="Assinatura cadastrada" className="mx-auto max-h-16" />
        ) : (
          <p className="py-4 text-xs text-slate-400">
            Nenhuma assinatura enviada. Sem ela o documento sai com a linha para
            assinar à mão.
          </p>
        )}
        <div className="mx-auto mt-2 w-48 border-t border-slate-300 pt-1 dark:border-ink-600">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {signature.name}
          </p>
          {signature.council ? (
            <p className="text-[10px] text-slate-500">{signature.council}</p>
          ) : (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Registro profissional não cadastrado
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-500 disabled:opacity-40 dark:border-ink-600 dark:text-slate-300"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {current ? "Trocar" : "Enviar assinatura"}
        </button>
        {current && (
          <button
            onClick={() => persist(null)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        PNG com fundo transparente fica melhor. Máx. 200 KB.
      </p>
    </div>
  );
}
