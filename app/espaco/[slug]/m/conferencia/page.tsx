import { prisma } from "@/lib/db";
import {
  ClipboardList,
  ClockAlert,
  PackageSearch,
  ScanBarcode,
  CircleDollarSign,
  Target,
} from "lucide-react";
import { loadModule, DeniedModule, ModuleHeader, KpiCard } from "../module-kit";
import { hasPermission } from "@/lib/endurance/permissions";
import { countDashboard } from "@/lib/endurance/stock-count";
import ConferenciaClient from "./conferencia-client";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function ConferenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "conferencia");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  const org = session?.org ?? "";

  const filters = {
    status: sp.status || undefined,
    type: sp.type || undefined,
    responsibleId: sp.resp || undefined,
    location: sp.loc || undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(`${sp.to}T23:59:59`) : undefined,
  };

  const [dash, users, cats] = org
    ? await Promise.all([
        countDashboard(org, filters),
        prisma.user.findMany({
          where: { organizationId: org },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.product.findMany({
          where: { organizationId: org, category: { not: "" } },
          select: { category: true },
          distinct: ["category"],
          orderBy: { category: "asc" },
        }),
      ])
    : [
        {
          inProgress: 0,
          awaiting: 0,
          itemsCounted: 0,
          itemsDivergent: 0,
          divergenceValue: 0,
          accuracy: 100,
          list: [],
        },
        [],
        [],
      ];

  const canApprove = hasPermission(
    session?.role ?? "MEMBER",
    session?.permissions,
    "count.approve",
  );

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />

      {/* Dashboard operacional */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={ClipboardList}
          label="Em andamento"
          value={String(dash.inProgress)}
          sub="rascunho + em conferência"
          from="from-cyan-500"
        />
        <KpiCard
          icon={ClockAlert}
          label="Aguardando aprovação"
          value={String(dash.awaiting)}
          sub="divergências a revisar"
          from="from-amber-500"
        />
        <KpiCard
          icon={Target}
          label="Acuracidade do estoque"
          value={`${dash.accuracy.toFixed(1)}%`}
          sub={`${dash.itemsCounted} itens conferidos`}
          from="from-emerald-500"
        />
        <KpiCard
          icon={PackageSearch}
          label="Itens conferidos"
          value={String(dash.itemsCounted)}
          sub="no período/filtro"
          from="from-violet-500"
        />
        <KpiCard
          icon={ScanBarcode}
          label="Itens com divergência"
          value={String(dash.itemsDivergent)}
          sub="sistema ≠ físico"
          from="from-rose-500"
        />
        <KpiCard
          icon={CircleDollarSign}
          label="Divergência estimada"
          value={brl(dash.divergenceValue)}
          sub="valor financeiro (a custo)"
          from="from-amber-500"
        />
      </div>

      <ConferenciaClient
        slug={slug}
        list={dash.list}
        users={users}
        categories={cats.map((c) => c.category)}
        canApprove={canApprove}
        filters={{
          status: sp.status ?? "",
          type: sp.type ?? "",
          resp: sp.resp ?? "",
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />
    </div>
  );
}
