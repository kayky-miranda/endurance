import { AlertTriangle, Boxes, Package, Store } from "lucide-react";
import { prisma } from "@/lib/db";
import { money } from "@/lib/endurance/money";
import { listLocations } from "@/lib/endurance/locations";
import { parseSort, PRODUCT_SORT_FIELDS } from "@/lib/endurance/sorting";
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
  searchParams: Promise<{ q?: string; pagina?: string; ord?: string; dir?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { mod, session, denied } = await loadModule(slug, "estoque");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;

  // Lista paginada no banco; KPIs por agregação (não carrega o catálogo todo).
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);
  // Padrão do Estoque: menor saldo primeiro (o que precisa de atenção no topo).
  const sort = parseSort(sp, PRODUCT_SORT_FIELDS, { field: "stock", dir: "asc" });
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
          orderBy: { [sort.field]: sort.dir },
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

  // Distribuição do estoque por local (só faz sentido com mais de um).
  const locations = session ? await listLocations(session.org) : [];
  const multiLocal = locations.filter((l) => l.active).length > 1;
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

      {multiLocal && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <p className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Store className="h-4 w-4 text-brand-500" /> Estoque por local
            <span className="font-normal text-slate-400">
              · o total acima é a soma de todos
            </span>
          </p>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 dark:bg-ink-800">
            {locations
              .filter((l) => l.active)
              .map((l) => (
                <div key={l.id} className="bg-white p-4 dark:bg-ink-900">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {l.name}
                    {l.isDefault && (
                      <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                        padrão
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {l.units}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      un. · {l.skus} produto(s)
                    </span>
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <StockAdvicePanel />

      <ReplenishmentTable items={replen.items} totalCost={replen.totalCost} />

      <ProductsClient
        products={products}
        showAdd={false}
        pager={{ total, page, pageSize: PAGE_SIZE, q, sort }}
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
