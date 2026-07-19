import { AlertTriangle, Boxes, Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import {
  getReplenishment,
  type ReplenItem,
} from "@/lib/endurance/replenishment";
import ProductsClient, { type Product } from "../products-client";
import StockAdvicePanel from "../stock-advice-panel";
import {
  loadModule,
  DeniedModule,
  ModuleHeader,
  StockStat,
  brl,
} from "../module-kit";

// Controle de estoque — entradas, saídas e reposição inteligente.
const PAGE_SIZE = 100;

export default async function EstoquePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "estoque");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  // Lista paginada no banco; KPIs por agregação (não carrega o catálogo todo).
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);
  const where = {
    organizationId: session?.org ?? "",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total, agg] = session
    ? await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { stock: "asc" },
          take: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        prisma.product.count({ where }),
        prisma.product.aggregate({
          where: { organizationId: session.org },
          _count: true,
          _sum: { stock: true },
        }),
      ])
    : [[], 0, { _count: 0, _sum: { stock: 0 } }];
  const products: Product[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    ncm: p.ncm,
    unit: p.unit,
    price: money(p.price),
    stock: p.stock,
  }));
  const unidades = agg._sum.stock ?? 0;
  const totalProdutos = agg._count;
  const replen = session
    ? await getReplenishment(session.org)
    : { items: [], totalCost: 0, needing: 0 };

  return (
    <div className="space-y-6">
      <ModuleHeader slug={slug} label={mod.label} description={mod.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StockStat
          label="Produtos cadastrados"
          value={totalProdutos}
          icon={Package}
        />
        <StockStat label="Unidades em estoque" value={unidades} icon={Boxes} />
        <StockStat
          label="Itens a repor"
          value={replen.needing}
          icon={AlertTriangle}
          warn
        />
      </div>

      <StockAdvicePanel />

      <ReplenishmentTable items={replen.items} totalCost={replen.totalCost} />

      <ProductsClient
        products={products}
        showAdd={false}
        pager={{ total, page, pageSize: PAGE_SIZE, q }}
      />
    </div>
  );
}

const LEVEL_STYLE: Record<string, { label: string; cls: string }> = {
  rompido: {
    label: "Rompido",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  critico: {
    label: "Crítico",
    cls: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  atencao: {
    label: "Atenção",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ok: {
    label: "Planejar",
    cls: "bg-slate-400/15 text-slate-500 dark:text-slate-400",
  },
};

function ReplenishmentTable({
  items,
  totalCost,
}: {
  items: ReplenItem[];
  totalCost: number;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-ink-700 dark:bg-ink-900 dark:text-slate-400">
        Nenhuma reposição necessária no momento — estoque dentro da cobertura. ✅
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Reposição inteligente
          <span className="ml-2 font-normal text-slate-400">
            previsão de demanda · cobertura 14 dias
          </span>
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compra estimada:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {brl(totalCost)}
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Produto</th>
              <th className="px-5 py-2.5 font-medium">Estoque</th>
              <th className="px-5 py-2.5 font-medium">Venda/dia</th>
              <th className="px-5 py-2.5 font-medium">Demanda 7d</th>
              <th className="px-5 py-2.5 font-medium">Acaba em</th>
              <th className="px-5 py-2.5 font-medium">Comprar</th>
              <th className="px-5 py-2.5 font-medium">Custo est.</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const st = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.ok;
              return (
                <tr
                  key={a.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {a.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {a.stock}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {a.avgDaily}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {a.forecast7}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {a.daysLeft === null ? "—" : `~${a.daysLeft} dias`}
                  </td>
                  <td className="px-5 py-3 font-bold text-brand-600 dark:text-brand-300">
                    +{a.suggestedQty}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {a.estCost > 0 ? brl(a.estCost) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
