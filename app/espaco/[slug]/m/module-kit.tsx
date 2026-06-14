/**
 * Kit compartilhado das rotas de módulo (/espaco/[slug]/m/*).
 *
 * Cada módulo tem a própria rota (m/pdv, m/financeiro, …) e abre com
 * `loadModule()`: valida o espaço, confere se o módulo está ativo e aplica o
 * RBAC granular. Os componentes visuais comuns (header, KPIs, ranking, estados
 * vazios) vivem aqui; tabelas específicas ficam na rota do módulo.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession, type SessionPayload } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule } from "@/lib/endurance/permissions";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ModuleContext {
  mod: { id: string; label: string; description: string; core: boolean };
  session: SessionPayload | null;
  denied: boolean;
}

/**
 * Guarda padrão das páginas de módulo: 404 se o espaço não existe ou o módulo
 * não está ativo nele; `denied` se o perfil não tem a permissão do módulo.
 * getWorkspace/getSession são deduplicados por request (React cache).
 */
export async function loadModule(
  slug: string,
  moduleId: string,
): Promise<ModuleContext> {
  const ws = await getWorkspace(slug);
  if (!ws) notFound();
  const mod = ws.modules.find((m) => m.id === moduleId);
  if (!mod) notFound();
  const session = await getSession();
  const denied = Boolean(
    session && !canAccessModule(session.role, session.permissions, moduleId),
  );
  return { mod, session, denied };
}

export function ModuleHeader({
  slug,
  label,
  description,
}: {
  slug: string;
  label: string;
  description: string;
}) {
  return (
    <div>
      <Link
        href={`/espaco/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Visão geral
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{label}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

/** Tela de acesso negado pelo RBAC (perfil sem a permissão do módulo). */
export function DeniedModule({
  slug,
  mod,
}: {
  slug: string;
  mod: ModuleContext["mod"];
}) {
  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid place-items-center rounded-2xl border border-dashed border-amber-300 bg-amber-500/5 px-6 py-16 text-center dark:border-amber-500/30">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Acesso restrito
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          O seu perfil não tem a permissão necessária para acessar o módulo{" "}
          <strong>{mod.label}</strong>. Fale com o responsável do espaço se
          precisar de acesso.
        </p>
      </div>
    </div>
  );
}

/** Caixa tracejada para estados vazios ("sem dados ainda", "sessão expirada"). */
export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  from,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  from: string;
  to: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${from} ${to} p-5 text-white shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm/5 text-white/80">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold">{value}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sub && <p className="mt-3 text-xs text-white/90">{sub}</p>}
    </div>
  );
}

export function RankList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; meta: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sem dados.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {r.label}
              </span>
              <span className="text-xs text-slate-400">{r.meta}</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StockStat({
  label,
  value,
  icon: Icon,
  warn,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div
        className={`grid h-11 w-11 place-items-center rounded-xl ${
          warn
            ? "bg-red-500/10 text-red-500"
            : "bg-brand-500/10 text-brand-500"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {value}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
