import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import {
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/endurance/workspace";
import { getSession } from "@/lib/auth";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import {
  effectivePermissions,
  modulePermission,
} from "@/lib/endurance/permissions";
import { getSalesSummary } from "@/lib/endurance/sales-analytics";
import { money } from "@/lib/endurance/money";
import { SalesByDayChart, PaymentMixChart } from "./m/reports-charts";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

export default async function EspacoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getWorkspace(slug);
  if (!ws) notFound();
  const session = await getSession();
  const firstName = (session?.name || "").split(" ")[0];

  // Módulos que o usuário pode acessar (RBAC por papel + permissão).
  const perms = new Set(
    effectivePermissions(session?.role ?? "MEMBER", session?.permissions),
  );
  const visible = ws.modules.filter((m) => {
    if (!session) return true;
    if (!canAccessModule(session.role as AccessRole, m.id)) return false;
    const required = modulePermission(m.id);
    return required ? perms.has(required) : true;
  });

  // RBAC: a Visão geral (com faturamento) exige a permissão "Visualizar
  // Dashboard". Sem ela, leva o usuário à primeira área acessível; se não
  // houver nenhuma, mostra um aviso de acesso restrito.
  if (session && !perms.has("dashboard.view")) {
    if (visible.length > 0) {
      // Prefere uma área COM menu lateral. O PDV roda em tela cheia (sem
      // navegação), então evitamos cair nele — senão o usuário fica "preso"
      // ao sair do caixa, sem como acessar os outros módulos.
      const target = visible.find((m) => m.id !== "pdv") ?? visible[0];
      redirect(`/espaco/${slug}/m/${target.id}`);
    }
    return <NoDashboardAccess />;
  }

  const orgId = session?.org ?? "";
  const summary = orgId
    ? await getSalesSummary(orgId, 30)
    : null;
  const [recent, customerCount] = orgId
    ? await Promise.all([
        prisma.sale.findMany({
          where: { organizationId: orgId },
          include: { customer: true, payments: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.customer.count({ where: { organizationId: orgId } }),
      ])
    : [[], 0];

  const core = visible.filter((m) => m.core);
  const niche = visible.filter((m) => !m.core);

  const stats = [
    {
      label: "Faturamento (30d)",
      value: brl(summary?.faturamento ?? 0),
      sub: `Hoje: ${brl(summary?.hojeFaturamento ?? 0)}`,
      icon: DollarSign,
      from: "from-cyan-500",
      to: "to-cyan-600",
    },
    {
      label: "Vendas (30d)",
      value: String(summary?.vendas ?? 0),
      sub: `Hoje: ${summary?.hojeVendas ?? 0}`,
      icon: ShoppingCart,
      from: "from-violet-500",
      to: "to-violet-600",
    },
    {
      label: "Ticket médio",
      value: brl(summary?.ticketMedio ?? 0),
      sub: `${summary?.itens ?? 0} itens vendidos`,
      icon: TrendingUp,
      from: "from-emerald-500",
      to: "to-emerald-600",
    },
    {
      label: "Clientes",
      value: String(customerCount),
      sub: "cadastrados",
      icon: Users,
      from: "from-amber-500",
      to: "to-amber-600",
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bem-vindo{firstName ? `, ${firstName}` : ""}! 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Um resumo do {ws.name} — dados reais das suas vendas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl bg-gradient-to-br ${s.from} ${s.to} p-5 text-white shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm/5 text-white/80">{s.label}</p>
                <p className="mt-1 truncate text-2xl font-bold">{s.value}</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-white/90">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficos reais */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Vendas por dia
          </h2>
          {summary && summary.vendas > 0 ? (
            <SalesByDayChart data={summary.porDia} />
          ) : (
            <EmptySales slug={slug} />
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Formas de pagamento
          </h2>
          <PaymentMixChart data={summary?.pagamentos ?? []} />
        </div>
      </div>

      {/* Vendas recentes (reais) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Vendas recentes
          </h2>
          <Link
            href={`/espaco/${slug}/m/relatorios`}
            className="text-xs text-brand-500 hover:underline"
          >
            ver painel
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-400">
            Nenhuma venda ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                  <th className="px-5 py-2.5 font-medium">Data</th>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Pagamento</th>
                  <th className="px-5 py-2.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                  >
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.createdAt.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                      {s.customer?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.payments
                        .map((p) => PAY_LABEL[p.method] ?? p.method)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {brl(money(s.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ToolGrid title="O essencial — todo negócio usa" slug={slug} modules={core} />
      {niche.length > 0 && (
        <ToolGrid
          title={`Feito para ${ws.nicheLabel}`}
          slug={slug}
          modules={niche}
        />
      )}
    </div>
  );
}

function NoDashboardAccess() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-amber-300 bg-amber-500/5 px-6 py-20 text-center dark:border-amber-500/30">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
        Acesso restrito
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Você não tem permissão para ver a Visão geral e ainda não há nenhuma área
        liberada para o seu perfil. Fale com o administrador do espaço.
      </p>
    </div>
  );
}

function EmptySales({ slug }: { slug: string }) {
  return (
    <div className="grid h-[260px] place-items-center text-center">
      <p className="text-sm text-slate-400">
        Sem vendas ainda. Abra o{" "}
        <Link
          href={`/espaco/${slug}/m/pdv`}
          className="font-medium text-brand-500 hover:underline"
        >
          PDV
        </Link>{" "}
        para registrar a primeira.
      </p>
    </div>
  );
}

function ToolGrid({
  title,
  slug,
  modules,
}: {
  title: string;
  slug: string;
  modules: { id: string; label: string; description: string }[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/espaco/${slug}/m/${m.id}`}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-md dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="h-1.5 w-8 rounded-full bg-brand-500/60 transition group-hover:w-12" />
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-brand-500 dark:text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {m.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              {m.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
