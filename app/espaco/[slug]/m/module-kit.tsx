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
import { ArrowLeft, Lock, Download, Sparkles, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession, type SessionPayload } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule } from "@/lib/endurance/permissions";
import {
  PLAN_FEATURE_CATALOG,
  modulePlanFeature,
  planById,
  type PlanFeature,
  type PlanId,
} from "@/lib/endurance/billing";
import { checkPlanFeature } from "@/lib/endurance/plan-limits";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ModuleContext {
  mod: { id: string; label: string; description: string; core: boolean };
  session: SessionPayload | null;
  /** O PERFIL não permite (beco sem saída — só explica). */
  denied: boolean;
  /** O PLANO não inclui (decisão comercial — oferece upgrade). */
  planLocked: boolean;
  planFeature: PlanFeature | null;
  requiredPlan: PlanId | null;
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

  // Só consulta o plano quando o módulo realmente depende de uma capacidade —
  // a maioria não depende, e essa checagem custa uma consulta a mais.
  const feature = modulePlanFeature(moduleId);
  let planLocked = false;
  let requiredPlan: PlanId | null = null;
  if (feature && session && !denied) {
    const verdict = await checkPlanFeature(session.org, feature);
    planLocked = !verdict.ok;
    requiredPlan = verdict.requiredPlan;
  }

  return { mod, session, denied, planLocked, planFeature: feature, requiredPlan };
}

export function ModuleHeader({
  slug,
  label,
  description,
  action,
}: {
  slug: string;
  label: string;
  description: string;
  /** Ação à direita do título (ex.: botão Exportar CSV). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
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
      {action}
    </div>
  );
}

/** Botão padrão "Exportar CSV" para o cabeçalho dos módulos. */
export function ExportCsvButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:text-slate-300"
    >
      <Download className="h-4 w-4" /> Exportar CSV
    </a>
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

/**
 * Bloqueio por PLANO — irmão do `DeniedModule`, mas com intenção oposta.
 *
 * Falta de permissão é um beco sem saída: o usuário não pode resolver sozinho,
 * então a tela só explica. Falta de plano é uma decisão comercial que ele PODE
 * tomar agora — então a tela mostra o que se ganha e leva ao upgrade. Bloquear
 * sem oferecer o caminho seria transformar uma oportunidade de receita em
 * frustração.
 */
export function PlanLocked({
  slug,
  feature,
  requiredPlan,
  /** Cabeçalho de módulo, quando o bloqueio ocupa a página inteira. */
  mod,
}: {
  slug: string;
  feature: PlanFeature;
  requiredPlan: PlanId | null;
  mod?: ModuleContext["mod"];
}) {
  const def = PLAN_FEATURE_CATALOG[feature];
  const plan = requiredPlan ? planById(requiredPlan) : null;
  // Mostra o que MAIS vem junto — o valor está no conjunto, não no item isolado.
  const alsoIncluded = (plan?.adds ?? [])
    .filter((f) => f !== feature)
    .slice(0, 4)
    .map((f) => PLAN_FEATURE_CATALOG[f].label);

  return (
    <div className="space-y-6">
      {mod && (
        <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      )}
      <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/15 text-brand-500">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          {def.label} está no plano {plan?.name ?? "superior"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {def.pitch}
        </p>

        {alsoIncluded.length > 0 && (
          <div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-ink-700 dark:bg-ink-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              No {plan?.name} também entram
            </p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {alsoIncluded.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={`/espaco/${slug}/assinatura`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
        >
          Ver planos
          {plan?.priceMonthly ? (
            <span className="font-normal opacity-80">
              · a partir de R${plan.priceMonthly}/mês
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

/**
 * Aviso compacto para bloquear um BOTÃO sem tomar a página — ex.: exportar CSV
 * dentro de uma tela que o cliente pode usar normalmente.
 */
export function PlanLockedInline({
  slug,
  feature,
  requiredPlan,
}: {
  slug: string;
  feature: PlanFeature;
  requiredPlan: PlanId | null;
}) {
  const def = PLAN_FEATURE_CATALOG[feature];
  const plan = requiredPlan ? planById(requiredPlan) : null;
  return (
    <Link
      href={`/espaco/${slug}/assinatura`}
      title={def.pitch}
      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-brand-500/50 px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {def.label}
      <span className="font-normal opacity-70">· {plan?.name ?? "upgrade"}</span>
    </Link>
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

/**
 * KPI do Design System — padrão premium/neutro (referência: Linear/Stripe):
 * fundo neutro, borda sutil, ícone em chip colorido e valor em destaque
 * tipográfico. A cor de acento aparece SÓ no chip do ícone — nunca domina o
 * card (os antigos gradientes fortes viravam um arco-íris no dashboard).
 *
 * Compat: as props `from`/`to` dos call-sites antigos ("from-cyan-500" etc.)
 * seguem aceitas — `from` vira o tom de acento do chip e `to` é ignorada.
 */
const KPI_TONES: Record<string, { chip: string; ring: string }> = {
  cyan: {
    chip: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
    ring: "hover:border-brand-500/40",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    ring: "hover:border-violet-500/40",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    ring: "hover:border-emerald-500/40",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    ring: "hover:border-amber-500/40",
  },
  orange: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    ring: "hover:border-amber-500/40",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    ring: "hover:border-rose-500/40",
  },
  red: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    ring: "hover:border-rose-500/40",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    ring: "hover:border-sky-500/40",
  },
  indigo: {
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    ring: "hover:border-violet-500/40",
  },
};

function kpiTone(from?: string) {
  const color = (from ?? "").match(/from-([a-z]+)-/)?.[1] ?? "cyan";
  return KPI_TONES[color] ?? KPI_TONES.cyan;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  from,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  /** Legado: "from-cyan-500" etc. — usado só para derivar o tom do chip. */
  from?: string;
  /** Legado: ignorado (o gradiente foi substituído pelo padrão neutro). */
  to?: string;
}) {
  const t = kpiTone(from);
  return (
    <div
      className={`group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-ink-700 dark:bg-ink-900 ${t.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition group-hover:scale-110 ${t.chip}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {sub && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
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
