import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  IdCard,
  ShoppingBag,
  Wallet,
  Repeat,
  CalendarDays,
  AlertTriangle,
  Star,
} from "lucide-react";
import { getCustomerProfile } from "@/lib/endurance/customer-profile";
import { loadModule, DeniedModule, KpiCard, brl } from "../../module-kit";

const SEGMENT_STYLE: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  ativo: {
    label: "Ativo",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  em_risco: {
    label: "Em risco",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  inativo: { label: "Inativo", cls: "bg-slate-400/15 text-slate-500" },
};

// Ficha do cliente: histórico de compras, preferências e fiado em aberto.
export default async function ClientePage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { mod, session, denied } = await loadModule(slug, "crm");
  if (denied) return <DeniedModule slug={slug} mod={mod} />;
  if (!session) notFound();

  const c = await getCustomerProfile(session.org, customerId);
  if (!c) notFound();

  const seg = SEGMENT_STYLE[c.segment] ?? SEGMENT_STYLE.novo;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/espaco/${slug}/m/crm`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${seg.cls}`}>
            {seg.label}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {c.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </span>
          )}
          {c.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {c.email}
            </span>
          )}
          {c.document && (
            <span className="inline-flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5" /> {c.document}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> cliente desde {c.createdAt}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Compras" value={String(c.orders)} icon={ShoppingBag} />
        <KpiCard label="Total gasto" value={brl(c.totalSpent)} icon={Wallet} />
        <KpiCard label="Ticket médio" value={brl(c.avgTicket)} icon={Repeat} />
        <KpiCard
          label="Última compra"
          value={
            c.lastPurchase
              ? c.lastDays === 0
                ? "hoje"
                : `há ${c.lastDays} dia${c.lastDays === 1 ? "" : "s"}`
              : "nunca"
          }
          icon={CalendarDays}
        />
      </div>

      {/* Fiado em aberto */}
      {c.openEntries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-amber-500/5">
          <p className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Em aberto: {brl(c.openTotal)} em {c.openEntries.length} lançamento(s)
          </p>
          <table className="w-full text-sm">
            <tbody>
              {c.openEntries.map((e) => (
                <tr key={e.id} className="border-t border-amber-500/20">
                  <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">
                    {e.description}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-slate-700 dark:text-slate-200">
                    {brl(e.amount)}
                  </td>
                  <td
                    className={`px-5 py-2.5 text-right text-xs ${
                      e.overdue
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-slate-500"
                    }`}
                  >
                    {e.overdue ? "vencido em " : "vence "}
                    {e.dueDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Produtos preferidos */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-1 dark:border-ink-700 dark:bg-ink-900">
          <p className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Star className="h-4 w-4 text-brand-500" /> Produtos preferidos
          </p>
          {c.favorites.length === 0 ? (
            <p className="px-5 pb-5 text-xs text-slate-500">
              Ainda sem compras registradas.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-ink-800">
              {c.favorites.map((f) => (
                <li key={f.name} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {f.qty}x · {brl(f.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Histórico de compras */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2 dark:border-ink-700 dark:bg-ink-900">
          <p className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <ShoppingBag className="h-4 w-4 text-brand-500" /> Histórico de compras
            {c.purchasesTotal > c.purchases.length && (
              <span className="font-normal text-slate-400">
                · {c.purchases.length} mais recentes de {c.purchasesTotal}
              </span>
            )}
          </p>
          {c.purchases.length === 0 ? (
            <p className="px-5 pb-5 text-xs text-slate-500">
              Este cliente ainda não comprou.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
                    <th className="px-5 py-2.5 font-medium">Venda</th>
                    <th className="px-5 py-2.5 font-medium">Data</th>
                    <th className="px-5 py-2.5 font-medium text-center">Itens</th>
                    <th className="px-5 py-2.5 font-medium">Pagamento</th>
                    <th className="px-5 py-2.5 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.purchases.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/espaco/${slug}/recibo/${p.id}`}
                          className="font-mono text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                        >
                          {p.code}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {p.date}
                      </td>
                      <td className="px-5 py-3 text-center text-slate-600 dark:text-slate-300">
                        {p.itemsCount}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {p.payments}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                        {brl(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
