"use client";

import { useState } from "react";
import {
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import type { Campaign } from "./types";

/** Fallback exibido enquanto a imagem do slide ainda está renderizando. */
function SlideTextPreview({
  slide,
}: {
  slide: { headline: string; layout: string; index: number };
}) {
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-center text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
          Slide {slide.index + 1} · {slide.layout}
        </p>
        <p className="mt-3 text-lg font-bold leading-snug">{slide.headline}</p>
        <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin opacity-60" />
        <p className="mt-2 text-xs opacity-60">Renderizando…</p>
      </div>
    </div>
  );
}

export function CampaignPreview({ campaign }: { campaign: Campaign }) {
  const [cur, setCur] = useState(0);
  const slides = campaign.slides;
  const slide = slides[cur];

  async function downloadSlide(url: string, index: number) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slide_${index + 1}.png`;
    a.click();
  }

  async function copyCaption() {
    const text = slides.map((s) => s.headline).join("\n");
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="mb-3 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {campaign.prompt}
      </p>

      {/* Slide principal */}
      <div className="relative">
        {slide?.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={`Slide ${cur + 1}`}
            className="aspect-[4/5] w-full rounded-xl object-cover"
          />
        ) : (
          <SlideTextPreview slide={slide ?? { headline: "", layout: "", index: cur }} />
        )}
        {/* Navegação */}
        <button
          onClick={() => setCur((c) => Math.max(0, c - 1))}
          disabled={cur === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setCur((c) => Math.min(slides.length - 1, c + 1))}
          disabled={cur === slides.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white disabled:opacity-20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCur(i)}
            className={`relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition ${
              i === cur ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {s.imageUrl ? (
              <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-500/20">
                <ImageIcon className="h-4 w-4 text-brand-500" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Ações */}
      <div className="mt-3 flex gap-2">
        {slide?.imageUrl && (
          <button
            onClick={() => downloadSlide(slide.imageUrl, cur)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Download className="h-4 w-4" />
            Baixar slide {cur + 1}
          </button>
        )}
        <button
          onClick={copyCaption}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-ink-700 dark:hover:bg-ink-800"
        >
          <Copy className="h-4 w-4" />
          Copiar legenda
        </button>
      </div>
    </div>
  );
}
