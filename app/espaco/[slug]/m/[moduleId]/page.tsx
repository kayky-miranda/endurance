import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Wrench,
  Package,
  Boxes,
  AlertTriangle,
  Wallet,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Users,
  UserCheck,
  Clock,
  Percent,
  DollarSign,
  FileText,
  CheckCircle2,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Truck,
  PackageCheck,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/endurance/workspace";
import { canAccessModule, type AccessRole } from "@/lib/endurance/catalog";
import { modulePermission } from "@/lib/endurance/permissions";
import { sessionHasPermission } from "@/lib/auth";
import { getSalesSummary } from "@/lib/endurance/sales-analytics";
import {
  getReplenishment,
  type ReplenItem,
} from "@/lib/endurance/replenishment";
import ProductsClient, { type Product } from "../products-client";
import PdvClient from "../pdv-client";
import InsightsPanel from "../insights-panel";
import StockAdvicePanel from "../stock-advice-panel";
import { getCustomerInsights, type CustomerRow } from "@/lib/endurance/crm";
import CampaignsPanel from "../campaigns-panel";
import { getPricingAnalysis, type PricingRow } from "@/lib/endurance/pricing";
import PricingAdvicePanel from "../pricing-advice-panel";
import PricingSimulator from "../pricing-simulator";
import { getNfceOverview } from "@/lib/endurance/fiscal-service";
import {
  getImportedInvoices,
  type ImportedInvoiceRow,
} from "@/lib/endurance/invoice-import";
import FiscalClient from "../fiscal-client";
import { getCaixaOverview } from "@/lib/endurance/cash";
import CaixaClient from "../caixa-client";
import { getFinanceOverview } from "@/lib/endurance/finance";
import FinanceClient from "../finance-client";
import { getPurchasingOverview } from "@/lib/endurance/purchasing";
import PurchasingClient from "../purchasing-client";
import { getCashflow, type DRE } from "@/lib/endurance/cashflow";
import ImportClient from "../import-client";
import { SalesByDayChart, PaymentMixChart, CashflowChart } from "../reports-charts";
import CodigoBarrasClient from "../codigo-barras-client";
import NotificacoesClient from "../notificacoes-client";
import NfeClient from "../nfe-client";
import { getNotifications } from "@/lib/endurance/notifications";
import { getNfeOverview } from "@/lib/endurance/nfe-service";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const ws = await getWorkspace(slug);
  if (!ws) notFound();

  const mod = ws.modules.find((m) => m.id === moduleId);
  if (!mod) notFound(); // módulo não existe ou não está ativo neste espaço

  // "Acesso & multiusuário" é a Gestão de Usuários — vive em /equipe.
  if (moduleId === "acesso") redirect(`/espaco/${slug}/equipe`);

  // RBAC: bloqueia acesso direto por URL a módulos restritos — por papel
  // (gestor) E pela permissão granular do perfil do usuário.
  const gate = await getSession();
  const requiredPerm = modulePermission(moduleId);
  const denied =
    gate &&
    (!canAccessModule(gate.role as AccessRole, moduleId) ||
      (requiredPerm ? !sessionHasPermission(gate, requiredPerm) : false));
  if (denied) {
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        <div className="grid place-items-center rounded-2xl border border-dashed border-amber-300 bg-amber-500/5 px-6 py-16 text-center dark:border-amber-500/30">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Acesso restrito
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            O módulo <strong>{mod.label}</strong> é exclusivo para
            administradores. Fale com o responsável do espaço se precisar de
            acesso.
          </p>
        </div>
      </div>
    );
  }

  // Painel executivo de vendas (alimentado pelas vendas reais do PDV).
  if (moduleId === "relatorios") {
    const session = await getSession();
    const summary = session
      ? await getSalesSummary(session.org, 30)
      : null;
    const cashflow = session ? await getCashflow(session.org, 30) : null;
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/espaco/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-500 dark:text-slate-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Visão geral
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Painel executivo
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Vendas dos últimos {summary?.days ?? 30} dias — em tempo real, com
              insights gerados por IA.
            </p>
          </div>
          <Link
            href={`/espaco/${slug}/relatorio`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-ink-600 dark:bg-ink-900 dark:text-slate-300"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Link>
        </div>

        {!summary || summary.vendas === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ainda não há vendas registradas. Faça vendas no{" "}
              <Link
                href={`/espaco/${slug}/m/pdv`}
                className="font-medium text-brand-500 hover:underline"
              >
                PDV
              </Link>{" "}
              para alimentar o painel.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Wallet}
                label="Faturamento (30d)"
                value={brl(summary.faturamento)}
                sub={`Hoje: ${brl(summary.hojeFaturamento)}`}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={ShoppingCart}
                label="Vendas"
                value={String(summary.vendas)}
                sub={`Hoje: ${summary.hojeVendas}`}
                from="from-violet-500"
                to="to-violet-600"
              />
              <KpiCard
                icon={TrendingUp}
                label="Ticket médio"
                value={brl(summary.ticketMedio)}
                sub={`${summary.itens} itens vendidos`}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={Trophy}
                label="Top produto"
                value={summary.topProdutos[0]?.name ?? "—"}
                sub={
                  summary.topProdutos[0]
                    ? `${summary.topProdutos[0].qty} un. vendidas`
                    : ""
                }
                from="from-amber-500"
                to="to-amber-600"
              />
            </div>

            <InsightsPanel />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Vendas por dia
                </h2>
                <SalesByDayChart data={summary.porDia} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
                <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Formas de pagamento
                </h2>
                <PaymentMixChart data={summary.pagamentos} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <RankList
                title="Mais vendidos"
                rows={summary.topProdutos.map((p) => ({
                  label: p.name,
                  meta: `${p.qty} un.`,
                  value: brl(p.revenue),
                }))}
              />
              <RankList
                title="Ranking de vendedores"
                rows={summary.vendedores.map((v) => ({
                  label: v.name,
                  meta: `${v.vendas} venda(s)`,
                  value: brl(v.total),
                }))}
              />
            </div>

            {cashflow && (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900 lg:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Fluxo de caixa
                      <span className="ml-2 font-normal text-slate-400">
                        entradas × saídas (14 dias)
                      </span>
                    </h2>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ↑ {brl(cashflow.totalEntradas)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        ↓ {brl(cashflow.totalSaidas)}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        = {brl(cashflow.saldo)}
                      </span>
                    </div>
                  </div>
                  <CashflowChart data={cashflow.series} />
                </div>
                <DreCard dre={cashflow.dre} />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // CRM: fidelidade e recompra de clientes (core — serve a todos os nichos).
  if (moduleId === "crm") {
    const session = await getSession();
    const ci = session ? await getCustomerInsights(session.org) : null;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!ci || ci.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum cliente cadastrado ainda. Identifique clientes no{" "}
              <Link
                href={`/espaco/${slug}/m/pdv`}
                className="font-medium text-brand-500 hover:underline"
              >
                PDV
              </Link>{" "}
              durante a venda.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Users}
                label="Clientes"
                value={String(ci.total)}
                sub={`${ci.counts.ativo} ativos`}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={UserCheck}
                label="Ativos (30d)"
                value={String(ci.counts.ativo)}
                sub={`${ci.counts.em_risco} em risco`}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={Clock}
                label="Para recomprar"
                value={String(ci.dueList.length)}
                sub="previsto pela IA"
                from="from-amber-500"
                to="to-amber-600"
              />
              <KpiCard
                icon={TrendingUp}
                label="Ticket médio/cliente"
                value={brl(ci.ticketMedio)}
                from="from-violet-500"
                to="to-violet-600"
              />
            </div>

            <CampaignsPanel />

            {ci.dueList.length > 0 && (
              <RankList
                title="Clientes previstos para recompra"
                rows={ci.dueList.slice(0, 5).map((c) => ({
                  label: c.name,
                  meta:
                    c.lastDays !== null
                      ? `${c.lastDays}d sem comprar`
                      : "—",
                  value: brl(c.totalSpent),
                }))}
              />
            )}

            <CustomerTable rows={ci.customers} />
          </>
        )}
      </div>
    );
  }

  // Precificação inteligente: margens, preços e promoções (varejo).
  if (moduleId === "precificacao") {
    const session = await getSession();
    const analysis = session ? await getPricingAnalysis(session.org, 30) : null;
    const simProducts = analysis
      ? analysis.rows.map((r) => ({
          id: r.id,
          name: r.name,
          price: r.price,
          cost: r.cost,
          soldPerDay: r.soldPerDay,
        }))
      : [];
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!analysis || analysis.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cadastre produtos com preço e custo no{" "}
              <Link
                href={`/espaco/${slug}/m/produtos`}
                className="font-medium text-brand-500 hover:underline"
              >
                Cadastro de produtos
              </Link>{" "}
              para liberar a análise.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                icon={Percent}
                label="Margem média"
                value={`${analysis.avgMargin}%`}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={DollarSign}
                label="Lucro bruto (30d)"
                value={brl(analysis.grossProfit)}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Margem baixa/negativa"
                value={String(analysis.lowMarginCount)}
                from="from-amber-500"
                to="to-amber-600"
              />
            </div>

            <PricingAdvicePanel />
            <PricingSimulator products={simProducts} />
            <MarginTable rows={analysis.rows} />
          </>
        )}
      </div>
    );
  }

  // Fiscal — emissão de NFC-e (modelo 65) a partir das vendas do PDV.
  if (moduleId === "nfce") {
    const session = await getSession();
    const data = session ? await getNfceOverview(session.org) : null;
    const imported = session ? await getImportedInvoices(session.org) : [];
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!data ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sessão expirada.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={FileText}
                label="Emitidas hoje"
                value={String(data.kpis.emitidasHoje)}
                from="from-brand-500"
                to="to-brand-600"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Autorizadas no mês"
                value={String(data.kpis.autorizadasMes)}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={DollarSign}
                label="Faturado no mês"
                value={brl(data.kpis.valorMes)}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={Clock}
                label="Vendas sem NFC-e"
                value={String(data.kpis.pendentes)}
                from="from-amber-500"
                to="to-amber-600"
              />
            </div>

            <FiscalClient slug={slug} rows={data.rows} config={data.config} />
            <ImportedInvoicesList rows={imported} />
          </>
        )}
      </div>
    );
  }

  // Importação em massa (CSV/Excel) com modelo, validação e relatório de erros.
  if (moduleId === "importacao") {
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        <ImportClient slug={slug} />
      </div>
    );
  }

  // Fornecedores + pedidos de compra (reposição → compra → estoque → financeiro).
  if (moduleId === "fornecedores") {
    const session = await getSession();
    const data = session ? await getPurchasingOverview(session.org) : null;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!data ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sessão expirada.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={Truck}
                label="Fornecedores"
                value={String(data.kpis.fornecedores)}
                from="from-brand-500"
                to="to-brand-600"
              />
              <KpiCard
                icon={FileText}
                label="Pedidos em aberto"
                value={String(data.kpis.pedidosAbertos)}
                from="from-amber-500"
                to="to-amber-600"
              />
              <KpiCard
                icon={DollarSign}
                label="Valor em aberto"
                value={brl(data.kpis.valorAberto)}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={PackageCheck}
                label="Recebido no mês"
                value={brl(data.kpis.recebidoMes)}
                from="from-emerald-500"
                to="to-emerald-600"
              />
            </div>

            <PurchasingClient
              slug={slug}
              suppliers={data.suppliers}
              orders={data.orders}
              products={data.products}
              suggestion={data.suggestion}
            />
          </>
        )}
      </div>
    );
  }

  // Fechamento de caixa — turno do PDV (abertura, sangria/suprimento, conferência).
  if (moduleId === "caixa") {
    const session = await getSession();
    const overview = session
      ? await getCaixaOverview(session.org, session.sub, session.role)
      : null;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!overview ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sessão expirada.
            </p>
          </div>
        ) : (
          <CaixaClient overview={overview} />
        )}
      </div>
    );
  }

  // Financeiro — contas a receber/pagar (recebíveis vêm das vendas do PDV).
  if (moduleId === "financeiro") {
    const session = await getSession();
    const fin = session ? await getFinanceOverview(session.org) : null;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!fin ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sessão expirada.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={ArrowDownLeft}
                label="A receber"
                value={brl(fin.kpis.aReceber)}
                sub={`${brl(fin.kpis.recebidoMes)} recebido no mês`}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={ArrowUpRight}
                label="A pagar"
                value={brl(fin.kpis.aPagar)}
                sub={`${brl(fin.kpis.pagoMes)} pago no mês`}
                from="from-rose-500"
                to="to-rose-600"
              />
              <KpiCard
                icon={Banknote}
                label="Saldo previsto"
                value={brl(fin.kpis.saldoPrevisto)}
                from="from-brand-500"
                to="to-brand-600"
              />
              <KpiCard
                icon={AlertCircle}
                label="Vencidos"
                value={String(fin.kpis.vencidos)}
                from="from-amber-500"
                to="to-amber-600"
              />
            </div>

            <FinanceClient slug={slug} receber={fin.receber} pagar={fin.pagar} />
          </>
        )}
      </div>
    );
  }

  // Módulos com função real: Cadastro de produtos e Estoque (dados por empresa).
  if (
    moduleId === "produtos" ||
    moduleId === "estoque" ||
    moduleId === "pdv"
  ) {
    const session = await getSession();
    const rows = session
      ? await prisma.product.findMany({
          where: { organizationId: session.org },
          orderBy: moduleId === "estoque" ? { stock: "asc" } : { createdAt: "desc" },
        })
      : [];
    const products: Product[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      price: p.price,
      stock: p.stock,
    }));

    if (moduleId === "pdv") {
      return <PdvClient products={products} slug={slug} />;
    }

    if (moduleId === "estoque") {
      const unidades = products.reduce((s, p) => s + p.stock, 0);
      const replen = session
        ? await getReplenishment(session.org)
        : { items: [], totalCost: 0, needing: 0 };
      return (
        <div className="space-y-6">
          <Header slug={slug} label={mod.label} description={mod.description} />
          <div className="grid gap-4 sm:grid-cols-3">
            <StockStat
              label="Produtos cadastrados"
              value={products.length}
              icon={Package}
            />
            <StockStat
              label="Unidades em estoque"
              value={unidades}
              icon={Boxes}
            />
            <StockStat
              label="Itens a repor"
              value={replen.needing}
              icon={AlertTriangle}
              warn
            />
          </div>

          <StockAdvicePanel />

          <ReplenishmentTable
            items={replen.items}
            totalCost={replen.totalCost}
          />

          <ProductsClient products={products} showAdd={false} />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        <ProductsClient products={products} />
      </div>
    );
  }

  // Código de barras — geração de códigos e impressão de etiquetas.
  if (moduleId === "codigo_barras") {
    const session = await getSession();
    const rows = session
      ? await prisma.product.findMany({
          where: { organizationId: session.org },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const products = rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      barcode: p.barcode,
      stock: p.stock,
    }));
    const canManage = session
      ? sessionHasPermission(session, "products.manage")
      : false;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        <CodigoBarrasClient slug={slug} products={products} canManage={canManage} />
      </div>
    );
  }

  // Notificações — central de alertas operacionais (estoque, financeiro, CRM)
  // com envio por WhatsApp/e-mail.
  if (moduleId === "notificacoes") {
    const session = await getSession();
    const data = session
      ? await getNotifications(session.org)
      : { items: [], counts: { estoque: 0, financeiro: 0, clientes: 0 } };
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        <NotificacoesClient items={data.items} counts={data.counts} />
      </div>
    );
  }

  // NF-e (modelo 55) — emissão a partir de vendas com cliente identificado.
  if (moduleId === "nfe") {
    const session = await getSession();
    const data = session ? await getNfeOverview(session.org) : null;
    const canManage = session
      ? sessionHasPermission(session, "fiscal.manage")
      : false;
    return (
      <div className="space-y-6">
        <Header slug={slug} label={mod.label} description={mod.description} />
        {!data ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Sessão expirada.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={FileText}
                label="Emitidas hoje"
                value={String(data.kpis.emitidasHoje)}
                from="from-brand-500"
                to="to-brand-600"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Autorizadas no mês"
                value={String(data.kpis.autorizadasMes)}
                from="from-emerald-500"
                to="to-emerald-600"
              />
              <KpiCard
                icon={DollarSign}
                label="Faturado no mês"
                value={brl(data.kpis.valorMes)}
                from="from-cyan-500"
                to="to-cyan-600"
              />
              <KpiCard
                icon={Clock}
                label="Vendas elegíveis sem NF-e"
                value={String(data.kpis.pendentes)}
                from="from-amber-500"
                to="to-amber-600"
              />
            </div>
            <NfeClient slug={slug} rows={data.rows} config={data.config} canManage={canManage} />
          </>
        )}
      </div>
    );
  }

  // Demais módulos: placeholder
  return (
    <div className="space-y-6">
      <Header slug={slug} label={mod.label} description={mod.description} />
      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-900">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Wrench className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Em construção
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          As telas do módulo <strong>{mod.label}</strong> entram nas próximas
          etapas. Ele já está ativo no seu espaço e com os dados isolados por
          empresa.
        </p>
      </div>
    </div>
  );
}

const MARGIN_STYLE: Record<string, { label: string; cls: string }> = {
  negativa: {
    label: "Negativa",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  baixa: {
    label: "Baixa",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ok: {
    label: "Saudável",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
};

function MarginTable({ rows }: { rows: PricingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Margem por produto
        <span className="ml-2 font-normal text-slate-400">
          últimos 30 dias · piores margens primeiro
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Produto</th>
              <th className="px-5 py-2.5 font-medium">Preço</th>
              <th className="px-5 py-2.5 font-medium">Custo</th>
              <th className="px-5 py-2.5 font-medium">Margem</th>
              <th className="px-5 py-2.5 font-medium">Vendidos</th>
              <th className="px-5 py-2.5 font-medium">Lucro (30d)</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = MARGIN_STYLE[r.level] ?? MARGIN_STYLE.ok;
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {r.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {brl(r.price)}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {brl(r.cost)}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {r.margin}%
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {r.soldQty}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {brl(r.profit)}
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

const SEGMENT_STYLE: Record<string, { label: string; cls: string }> = {
  novo: {
    label: "Novo",
    cls: "bg-slate-400/15 text-slate-500 dark:text-slate-400",
  },
  ativo: {
    label: "Ativo",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  em_risco: {
    label: "Em risco",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  inativo: {
    label: "Inativo",
    cls: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

function CustomerTable({ rows }: { rows: CustomerRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Clientes ({rows.length})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Cliente</th>
              <th className="px-5 py-2.5 font-medium">Compras</th>
              <th className="px-5 py-2.5 font-medium">Total gasto</th>
              <th className="px-5 py-2.5 font-medium">Última compra</th>
              <th className="px-5 py-2.5 font-medium">Segmento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const st = SEGMENT_STYLE[c.segment] ?? SEGMENT_STYLE.novo;
              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 dark:border-ink-800"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {c.name}
                      {c.dueRepurchase && (
                        <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                          recompra
                        </span>
                      )}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {c.orders}
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                    {brl(c.totalSpent)}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {c.lastDays === null ? "—" : `há ${c.lastDays} dias`}
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

function KpiCard({
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

function RankList({
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

function ImportedInvoicesList({ rows }: { rows: ImportedInvoiceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Notas fiscais importadas
        <span className="ml-2 font-normal text-slate-400">
          via XML · {rows.length}
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-ink-800">
              <th className="px-5 py-2.5 font-medium">Modelo</th>
              <th className="px-5 py-2.5 font-medium">Número</th>
              <th className="px-5 py-2.5 font-medium">Emitente</th>
              <th className="px-5 py-2.5 font-medium">Emissão</th>
              <th className="px-5 py-2.5 font-medium">Itens</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
              <th className="px-5 py-2.5 font-medium">Chave</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 last:border-0 dark:border-ink-800"
              >
                <td className="px-5 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                    {r.modelo === "65" ? "NFC-e" : "NF-e"} {r.modelo}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {r.numero}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {r.emitNome}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.dhEmi}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.itemsCount}
                </td>
                <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                  {brl(r.total)}
                </td>
                <td className="px-5 py-3 font-mono text-[10px] text-slate-400">
                  …{r.chave.slice(-16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DreCard({ dre }: { dre: DRE }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        DRE simplificado
        <span className="ml-2 font-normal text-slate-400">30 dias</span>
      </h2>
      <div className="space-y-1.5 text-sm">
        <DreLine label="Receita de vendas" value={dre.receita} />
        <DreLine label="(−) CMV" value={-dre.cmv} muted />
        <DreLine label="= Lucro bruto" value={dre.lucroBruto} bold />
        <p className="pl-1 text-xs text-slate-400">
          Margem bruta {dre.margemBruta}%
        </p>
        <DreLine label="(−) Despesas" value={-dre.despesas} muted />
        <div className="mt-1 border-t border-slate-100 pt-2 dark:border-ink-800">
          <DreLine label="= Resultado" value={dre.resultado} bold result />
        </div>
      </div>
    </div>
  );
}

function DreLine({
  label,
  value,
  bold,
  muted,
  result,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  result?: boolean;
}) {
  const brlv = value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return (
    <div className="flex justify-between">
      <span
        className={`${bold ? "font-semibold text-slate-700 dark:text-slate-200" : muted ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          result
            ? value >= 0
              ? "font-bold text-emerald-600 dark:text-emerald-400"
              : "font-bold text-red-600 dark:text-red-400"
            : bold
              ? "font-semibold text-slate-700 dark:text-slate-200"
              : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {brlv}
      </span>
    </div>
  );
}

function Header({
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

function StockStat({
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
