"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Palette, RotateCcw, Check } from "lucide-react";

export interface BrandKitData {
  primaryColor: string;
  darkColor: string;
  lightColor: string;
  lightBg: string;
  darkBg: string;
  fontHeading: string;
  fontBody: string;
  logoText: string;
  tagline: string;
  instagramHandle: string;
}

const COLOR_FIELDS: {
  key: keyof BrandKitData;
  label: string;
  desc: string;
}[] = [
  { key: "primaryColor", label: "Primária", desc: "Cor principal da marca" },
  { key: "darkColor", label: "Escura", desc: "CTA e texto em destaque" },
  { key: "lightColor", label: "Clara", desc: "Acento secundário" },
  { key: "lightBg", label: "Fundo claro", desc: "Slides com fundo claro" },
  { key: "darkBg", label: "Fundo escuro", desc: "Slides com fundo escuro" },
];

export default function BrandKitModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [kit, setKit] = useState<BrandKitData | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [customized, setCustomized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/marketing/brand-kit");
      if (res.ok) {
        const data = await res.json();
        setKit(data.brandKit);
        setFonts(data.fonts ?? []);
        setCustomized(data.customized);
      }
    })();
  }, []);

  function update<K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) {
    setKit((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!kit) return;
    setSaving(true);
    const res = await fetch("/api/marketing/brand-kit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kit),
    });
    setSaving(false);
    if (res.ok) {
      setCustomized(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function reset() {
    if (!confirm("Restaurar as cores e fontes padrão do nicho?")) return;
    setSaving(true);
    await fetch("/api/marketing/brand-kit", { method: "DELETE" });
    const res = await fetch("/api/marketing/brand-kit");
    if (res.ok) {
      const data = await res.json();
      setKit(data.brandKit);
      setCustomized(false);
    }
    setSaving(false);
  }

  if (!kit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="rounded-2xl bg-white p-10 dark:bg-ink-900">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-bold">Identidade visual</h2>
            {!customized && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                usando padrão do nicho
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview */}
        <div
          className="mb-6 grid grid-cols-5 gap-2 rounded-2xl border border-slate-200 p-3 dark:border-ink-700"
          style={{ background: kit.lightBg }}
        >
          {COLOR_FIELDS.map((f) => (
            <div key={f.key} className="text-center">
              <div
                className="mx-auto mb-1 h-12 w-12 rounded-xl border border-slate-200 shadow-sm dark:border-ink-700"
                style={{ background: kit[f.key] as string }}
              />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {f.label}
              </p>
            </div>
          ))}
        </div>

        {/* Cores */}
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Cores
        </h3>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-ink-700 dark:bg-ink-800"
            >
              <input
                type="color"
                value={kit[f.key] as string}
                onChange={(e) => update(f.key, e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {f.label}
                </p>
                <p className="text-[10px] text-slate-400">{f.desc}</p>
              </div>
              <input
                type="text"
                value={kit[f.key] as string}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs uppercase focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>
          ))}
        </div>

        {/* Fontes */}
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Tipografia
        </h3>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Fonte de títulos
            </label>
            <select
              value={kit.fontHeading}
              onChange={(e) => update("fontHeading", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Fonte de corpo
            </label>
            <select
              value={kit.fontBody}
              onChange={(e) => update("fontBody", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Identidade textual */}
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Marca
        </h3>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nome da marca (aparece nos slides)
            </label>
            <input
              type="text"
              value={kit.logoText}
              onChange={(e) => update("logoText", e.target.value)}
              placeholder="Ex.: ENDURANCE"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Handle do Instagram
            </label>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white dark:border-ink-700 dark:bg-ink-800">
              <span className="pl-3 text-sm text-slate-400">@</span>
              <input
                type="text"
                value={kit.instagramHandle}
                onChange={(e) => update("instagramHandle", e.target.value.replace(/^@/, ""))}
                placeholder="suaempresa"
                className="w-full rounded-r-xl bg-transparent px-1 py-2 text-sm focus:outline-none dark:text-white"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Slogan / tagline (opcional)
            </label>
            <input
              type="text"
              value={kit.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Ex.: O melhor mercado do bairro"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-ink-700">
          <button
            onClick={reset}
            disabled={!customized || saving}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-ink-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão do nicho
          </button>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3.5 w-3.5" />
                Salvo
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800"
            >
              Fechar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
