"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Palette,
  RotateCcw,
  Check,
  AlertTriangle,
  ShieldCheck,
  Upload,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { THEME_PRESETS, DEFAULT_PRESET } from "@/lib/theme-presets";
import { contrastRatio, wcagLevel } from "@/lib/theme-contrast";
import {
  saveThemeAction,
  resetThemeAction,
  uploadLogoAction,
  removeLogoAction,
  type ThemeInput,
} from "./aparencia-actions";

const COLOR_FIELDS: {
  key: keyof Omit<ThemeInput, "presetId" | "defaultDarkMode">;
  label: string;
  hint: string;
}[] = [
  { key: "primaryColor", label: "Cor primária", hint: "Botões, links, destaque" },
  { key: "secondaryColor", label: "Cor secundária", hint: "Acento mais suave" },
  { key: "buttonTextColor", label: "Texto sobre primária", hint: "Texto nos botões coloridos" },
  { key: "sidebarBgDark", label: "Sidebar (escuro)", hint: "Fundo da barra lateral" },
];

interface State {
  presetId: string;
  primaryColor: string;
  secondaryColor: string;
  buttonTextColor: string;
  sidebarBgDark: string;
  defaultDarkMode: boolean;
  logoDataUrl: string | null;
}

export default function AparenciaClient({ initial }: { initial: State }) {
  const router = useRouter();
  const [state, setState] = useState<State>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Aplica o tema localmente em tempo real — sem precisar salvar pra ver.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-brand-500", state.primaryColor);
    root.style.setProperty("--color-brand-200", state.secondaryColor);
    root.style.setProperty("--color-button-text", state.buttonTextColor);
    root.style.setProperty("--color-ink-950", state.sidebarBgDark);
  }, [state]);

  const contrast = useMemo(
    () => contrastRatio(state.buttonTextColor, state.primaryColor),
    [state.buttonTextColor, state.primaryColor],
  );
  const level = wcagLevel(contrast);

  function applyPreset(id: string) {
    const p = THEME_PRESETS.find((x) => x.id === id) ?? DEFAULT_PRESET;
    setState((s) => ({
      ...s,
      presetId: p.id,
      primaryColor: p.primary,
      secondaryColor: p.primarySoft,
      buttonTextColor: p.buttonText,
      sidebarBgDark: p.chrome950,
    }));
    setSaved(false);
  }

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value, presetId: "default" === s.presetId ? s.presetId : s.presetId }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const res = await saveThemeAction({
      presetId: state.presetId,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      buttonTextColor: state.buttonTextColor,
      sidebarBgDark: state.sidebarBgDark,
      defaultDarkMode: state.defaultDarkMode,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert(res.error);
    }
  }

  async function reset() {
    if (!confirm("Restaurar a aparência padrão? Você perderá as customizações.")) return;
    setResetting(true);
    await resetThemeAction();
    setResetting(false);
    applyPreset("default");
    router.refresh();
  }

  return (
    <>
      {/* LOGO */}
      <LogoSection
        logoDataUrl={state.logoDataUrl}
        onUploaded={(url) => setState((s) => ({ ...s, logoDataUrl: url }))}
        onRemoved={() => setState((s) => ({ ...s, logoDataUrl: null }))}
      />

      {/* PRESETS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Temas prontos</h2>
        <p className="mt-1 text-xs text-slate-500">
          Comece de um preset e ajuste cores individualmente se quiser.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PRESETS.map((p) => {
            const active = state.presetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`group relative overflow-hidden rounded-xl border-2 p-3 text-left transition ${
                  active
                    ? "border-brand-500 ring-2 ring-brand-500/30"
                    : "border-slate-200 hover:border-brand-400 dark:border-ink-700"
                }`}
                style={{ background: p.chrome900 }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{p.label}</p>
                  {active && (
                    <span className="rounded-full bg-white/20 p-1">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-white/60">{p.description}</p>
                <div className="mt-3 flex gap-1.5">
                  {[p.primary, p.primaryLight, p.primarySoft, p.chrome700, p.chrome950].map((c) => (
                    <span
                      key={c}
                      className="h-5 w-5 rounded-md ring-1 ring-white/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* PERSONALIZAÇÃO + PREVIEW */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Palette className="h-4 w-4 text-brand-500" />
            Personalização
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Override individual sobre o preset. Veja o resultado em tempo real ao lado.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-ink-700"
              >
                <input
                  type="color"
                  value={(state[f.key as keyof State] as string) || "#000000"}
                  aria-label={`Cor: ${f.label}`}
                  onChange={(e) =>
                    update(f.key as keyof State, e.target.value as State[keyof State])
                  }
                  className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {f.label}
                  </p>
                  <p className="text-[10px] text-slate-400">{f.hint}</p>
                </div>
                <input
                  type="text"
                  value={state[f.key as keyof State] as string}
                  aria-label={`Código da cor: ${f.label}`}
                  onChange={(e) =>
                    update(f.key as keyof State, e.target.value as State[keyof State])
                  }
                  className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] uppercase focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                />
              </div>
            ))}
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={state.defaultDarkMode}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultDarkMode: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            Iniciar usuários no modo escuro
          </label>

          {/* WCAG */}
          <div
            className={`mt-5 flex items-start gap-3 rounded-xl border p-3 text-xs ${
              level === "fail"
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                : level === "AA-large"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {level === "fail" ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-semibold">
                Contraste texto/botão: {contrast.toFixed(2)}:1 ·{" "}
                {level === "AAA"
                  ? "WCAG AAA"
                  : level === "AA"
                    ? "WCAG AA"
                    : level === "AA-large"
                      ? "AA apenas para texto grande"
                      : "Falha WCAG"}
              </p>
              <p className="mt-0.5 opacity-80">
                Mínimo recomendado: 4.5:1 (AA). Atual {level === "fail" ? "não atinge" : "atinge"} o limiar de leitura confortável.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={reset}
              disabled={resetting || saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-ink-700 dark:text-slate-300 dark:hover:bg-ink-800"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Restaurar padrão
            </button>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 dark:text-emerald-300">
                  Salvo
                </span>
              )}
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
                style={{ color: "var(--color-button-text)" }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar aparência
              </button>
            </div>
          </div>
        </section>

        {/* PREVIEW */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Pré-visualização</h2>
          <p className="mt-1 text-xs text-slate-500">Componentes-chave com a paleta atual.</p>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold hover:bg-brand-600"
              style={{ color: "var(--color-button-text)" }}
            >
              Botão primário
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-500"
            >
              Botão contorno
            </button>
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: state.sidebarBgDark, color: "#e6edf6" }}
            >
              <div className="mb-2 text-[10px] uppercase tracking-wider opacity-60">
                Sidebar
              </div>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Item ativo
              </div>
              <div className="mt-1 px-2 py-1.5 opacity-70">Outro item</div>
            </div>
            <div className="rounded-xl bg-brand-500/10 p-3 text-xs">
              <p className="font-semibold text-brand-600 dark:text-brand-300">
                Bloco de destaque
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                Esse é o tom suave aplicado em cards e banners informativos.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["brand-500", "brand-400", "brand-300", "brand-200"].map((c) => (
                <span
                  key={c}
                  className={`h-7 flex-1 rounded-md bg-${c}`}
                  title={c}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function LogoSection({
  logoDataUrl,
  onUploaded,
  onRemoved,
}: {
  logoDataUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 200 * 1024) {
      setError("Arquivo muito grande (máximo 200KB). Otimize a imagem.");
      return;
    }
    setUploading(true);
    const dataUrl = await fileToDataUrl(file);
    const res = await uploadLogoAction({ dataUrl, mime: file.type });
    setUploading(false);
    if (res.ok) {
      onUploaded(dataUrl);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function remove() {
    if (!confirm("Remover a logo? Voltamos pro ícone padrão.")) return;
    await removeLogoAction();
    onRemoved();
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <ImageIcon className="h-4 w-4 text-brand-500" />
        Logo da empresa
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Aparece na sidebar e nos e-mails enviados pelo sistema. PNG, SVG, JPEG ou WebP até 200KB.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-ink-700 dark:bg-ink-800">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              alt="Logo"
              className="max-h-16 max-w-16 object-contain"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-400" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold hover:bg-brand-600" style={{ color: "var(--color-button-text)" }}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Enviando…" : logoDataUrl ? "Trocar logo" : "Enviar logo"}
            <input
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
              disabled={uploading}
            />
          </label>
          {logoDataUrl && (
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="h-3 w-3" />
              Remover
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
