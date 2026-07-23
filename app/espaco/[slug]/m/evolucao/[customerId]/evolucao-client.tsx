"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  X,
} from "lucide-react";
import { useModalA11y } from "../../../use-modal-a11y";
import {
  METRIC_PRESETS,
  presetOf,
  formatMetric,
  sparklinePoints,
} from "@/lib/endurance/metrics";
import type { MetricSeries } from "@/lib/endurance/evolucao";
import {
  addMeasurementAction,
  deleteMeasurementAction,
} from "../evolucao-actions";

const SW = 200;
const SH = 44;

export default function EvolucaoClient({
  slug,
  customerId,
  series,
}: {
  slug: string;
  customerId: string;
  series: MetricSeries[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [presetMetric, setPresetMetric] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function removeMeasurement(id: string) {
    if (!confirm("Remover esta medição?")) return;
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteMeasurementAction({ id, customerId });
      setPendingId(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Indicadores acompanhados
        </h2>
        <button
          onClick={() => {
            setError("");
            setPresetMetric(undefined);
            setAdding(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova medição
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {series.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma medição ainda. Registre o primeiro valor para começar a
            acompanhar a evolução.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {series.map((s) => (
            <MetricCard
              key={s.metric}
              s={s}
              fmtDate={fmtDate}
              pendingId={pendingId}
              busy={busy}
              onRemove={removeMeasurement}
              onAdd={() => {
                setError("");
                setPresetMetric(s.metric);
                setAdding(true);
              }}
            />
          ))}
        </div>
      )}

      {adding && (
        <MeasurementModal
          customerId={customerId}
          initialMetric={presetMetric}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  s,
  fmtDate,
  pendingId,
  busy,
  onRemove,
  onAdd,
}: {
  s: MetricSeries;
  fmtDate: (iso: string) => string;
  pendingId: string | null;
  busy: boolean;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const values = s.points.map((p) => p.value);
  const pts = sparklinePoints(values, SW, SH);
  const stats = s.stats;
  const TrendIcon =
    stats?.direction === "up"
      ? TrendingUp
      : stats?.direction === "down"
        ? TrendingDown
        : Minus;
  const trendColor = !stats
    ? "text-slate-400"
    : stats.direction === "flat"
      ? "text-slate-400"
      : stats.improving
        ? "text-emerald-500"
        : "text-rose-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {s.label}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? formatMetric(stats.last, s.decimals) : "—"}
            </span>
            <span className="text-xs text-slate-400">{s.unit}</span>
          </p>
        </div>
        {stats && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {stats.delta > 0 ? "+" : ""}
            {formatMetric(stats.delta, s.decimals)} {s.unit}
          </span>
        )}
      </div>

      {values.length > 1 && (
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          className="mt-3 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Tendência de ${s.label}`}
        >
          <polyline
            points={pts}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={stats?.improving ? "text-emerald-500" : "text-brand-500"}
          />
        </svg>
      )}

      {stats && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
          <span>{stats.count} medições</span>
          <span>mín {formatMetric(stats.min, s.decimals)}</span>
          <span>máx {formatMetric(stats.max, s.decimals)}</span>
          <span>inicial {formatMetric(stats.first, s.decimals)}</span>
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs">
        <button
          onClick={onAdd}
          className="font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          + registrar
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          {expanded ? "ocultar histórico" : "ver histórico"}
        </button>
      </div>

      {expanded && (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 dark:divide-ink-800 dark:border-ink-800">
          {s.measurements.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-slate-400">
                {fmtDate(m.measuredAt)}
              </span>
              <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">
                {formatMetric(m.value, s.decimals)} {m.unit}
              </span>
              {m.notes && (
                <span className="hidden max-w-[40%] truncate text-xs text-slate-400 sm:inline">
                  {m.notes}
                </span>
              )}
              {pendingId === m.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : (
                <button
                  onClick={() => onRemove(m.id)}
                  disabled={busy}
                  aria-label="Remover medição"
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MeasurementModal({
  customerId,
  initialMetric,
  onClose,
  onSaved,
}: {
  customerId: string;
  initialMetric?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [metricKey, setMetricKey] = useState(initialMetric ?? METRIC_PRESETS[0].metric);
  const [customLabel, setCustomLabel] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const isCustom = metricKey === "__custom__";
  const preset = isCustom ? undefined : presetOf(metricKey);

  function submit() {
    setError("");
    const metric = isCustom ? customLabel : metricKey;
    startTransition(async () => {
      const res = await addMeasurementAction({
        customerId,
        metric,
        label: isCustom ? customLabel : preset?.label,
        value: Number(value.replace(",", ".")),
        unit: isCustom ? customUnit : preset?.unit,
        date,
        notes,
      });
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-modal-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="metric-modal-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            Nova medição
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <label className="block text-xs font-medium text-slate-500">
            Indicador
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            >
              {METRIC_PRESETS.map((p) => (
                <option key={p.metric} value={p.metric}>
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ""}
                </option>
              ))}
              <option value="__custom__">Outro (personalizado)…</option>
            </select>
          </label>

          {isCustom && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-500">
                Nome do indicador
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Ex.: Panturrilha"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Unidade
                <input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="cm, kg, %…"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-500">
              Valor{preset?.unit ? ` (${preset.unit})` : ""}
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-500">
            Observação (opcional)
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto da medição…"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100"
            />
          </label>

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
