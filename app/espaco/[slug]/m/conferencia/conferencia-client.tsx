"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  X,
  ClipboardCheck,
  Filter,
  AlertCircle,
} from "lucide-react";
import { createCountAction } from "./count-actions";
import { useModalA11y } from "../../use-modal-a11y";
import { CountStatusBadge, CountTypeBadge } from "./badges";
import {
  COUNT_STATUS_LABEL,
  COUNT_TYPE_LABEL,
} from "@/lib/endurance/stock-count-shared";
import type { CountListRow } from "@/lib/endurance/stock-count";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SELECT =
  "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-200";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-ink-600 dark:bg-ink-950 dark:text-slate-100";

export default function ConferenciaClient({
  slug,
  list,
  users,
  categories,
  locations,
  filters,
}: {
  slug: string;
  list: CountListRow[];
  users: { id: string; name: string }[];
  categories: string[];
  locations: { id: string; name: string; isDefault: boolean }[];
  canApprove: boolean;
  filters: { status: string; type: string; resp: string; from: string; to: string };
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  function applyFilter(key: string, value: string) {
    const p = new URLSearchParams(window.location.search);
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/espaco/${slug}/m/conferencia?${p.toString()}`);
  }

  const hasFilters =
    filters.status || filters.type || filters.resp || filters.from || filters.to;

  return (
    <div className="space-y-4">
      {/* Barra de filtros + ação principal */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <span className="inline-flex items-center gap-1.5 pl-1 text-xs font-medium text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </span>
        <select
          value={filters.status}
          onChange={(e) => applyFilter("status", e.target.value)}
          className={SELECT}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {Object.entries(COUNT_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => applyFilter("type", e.target.value)}
          className={SELECT}
          aria-label="Filtrar por tipo de conferência"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(COUNT_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.resp}
          onChange={(e) => applyFilter("resp", e.target.value)}
          className={SELECT}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => applyFilter("from", e.target.value)}
          className={SELECT}
          title="De"
         aria-label="De" />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => applyFilter("to", e.target.value)}
          className={SELECT}
          title="Até"
         aria-label="Até" />
        {hasFilters && (
          <button
            onClick={() => router.push(`/espaco/${slug}/m/conferencia`)}
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            Limpar
          </button>
        )}
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" /> Nova conferência
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {list.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhuma conferência {hasFilters ? "com esses filtros" : "ainda"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crie uma conferência para comparar o estoque do sistema com a
              contagem física.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 bg-white text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800 dark:bg-ink-900">
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Responsável</th>
                  <th className="px-4 py-2.5 font-medium text-center">Conferidos</th>
                  <th className="px-4 py-2.5 font-medium text-center">Divergências</th>
                  <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                  <th className="px-4 py-2.5 font-medium">Criada</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/espaco/${slug}/m/conferencia/${c.id}`)}
                    className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-ink-800 dark:hover:bg-ink-800/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-slate-700 dark:text-slate-200">
                        {c.number}
                      </p>
                      {c.location && (
                        <p className="text-xs text-slate-400">{c.location}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CountTypeBadge type={c.type} />
                    </td>
                    <td className="px-4 py-3">
                      <CountStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {c.responsibleName || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                      {c.countedTotal}/{c.itemsTotal}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.divergentTotal > 0 ? (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
                          {c.divergentTotal}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {c.divergenceValue > 0 ? brl(c.divergenceValue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <NewCountModal
          slug={slug}
          categories={categories}
          locations={locations}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function NewCountModal({
  slug,
  categories,
  locations,
  onClose,
}: {
  slug: string;
  categories: string[];
  locations: { id: string; name: string; isDefault: boolean }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [type, setType] = useState("geral");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [locationId, setLocationId] = useState(
    locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "",
  );
  const [blind, setBlind] = useState(false);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  function create() {
    setError("");
    startTransition(async () => {
      const res = await createCountAction({
        type,
        location,
        note,
        blind,
        locationId,
        // Geral carrega tudo; cíclica pode filtrar por categoria; parcial e por
        // localização começam vazias (itens adicionados na contagem).
        autoLoad: type === "geral" || (type === "ciclica" && !!category),
        categoryFilter: type === "ciclica" ? category || undefined : undefined,
      });
      if (res.ok && res.id) router.push(`/espaco/${slug}/m/conferencia/${res.id}`);
      else setError(res.error ?? "Não foi possível criar.");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-count-title"
        className="chippy-pop w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="new-count-title" className="text-base font-bold text-slate-900 dark:text-white">
            Nova conferência de estoque
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Tipo de conferência
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={INPUT}
            >
              <option value="geral">Geral (carrega todos os produtos)</option>
              <option value="parcial">Parcial (adiciona itens manualmente)</option>
              <option value="ciclica">Cíclica (por categoria)</option>
              <option value="localizacao">Por localização</option>
            </select>
          </label>

          {type === "ciclica" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Categoria
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={INPUT}
              >
                <option value="">Todas (carrega tudo)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          {locations.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Local conferido
              </span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className={INPUT}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.isDefault ? " (padrão)" : ""}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">
                A contagem compara com o saldo deste local, e o ajuste incide
                apenas nele.
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Ponto / corredor / prateleira (opcional)
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex.: Depósito central, Prateleira A3…"
              className={INPUT}
             aria-label="Ex.: Depósito central, Prateleira A3" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Observação (opcional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={INPUT}
            />
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 dark:border-ink-600">
            <input
              type="checkbox"
              checked={blind}
              onChange={(e) => setBlind(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Conferência cega
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                O operador conta sem ver o saldo do sistema (evita viés). As
                divergências aparecem só na etapa de aprovação.
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar e iniciar contagem
          </button>
        </div>
      </div>
    </div>
  );
}
