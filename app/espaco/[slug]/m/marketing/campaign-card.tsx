"use client";

import { Loader2, Image as ImageIcon } from "lucide-react";
import type { Campaign } from "./types";

export function CampaignCard({
  c,
  onSelect,
}: {
  c: Campaign;
  onSelect: () => void;
}) {
  const thumb = c.slides.find((s) => s.imageUrl)?.imageUrl;
  const statusColor =
    c.status === "ready"
      ? "bg-green-100 text-green-700"
      : c.status === "error"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  const statusLabel =
    c.status === "ready" ? "Pronto" : c.status === "error" ? "Erro" : "Renderizando";

  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="aspect-[4/5] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl bg-brand-500/10">
          {c.status === "rendering" ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          ) : (
            <ImageIcon className="h-6 w-6 text-brand-400" />
          )}
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200">
        {c.prompt}
      </p>
      <span
        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}
      >
        {statusLabel}
      </span>
    </button>
  );
}
