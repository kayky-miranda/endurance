import "server-only";
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
import {
  GoogleGenAI,
  Type,
  type Content,
  type Part,
  type FunctionDeclaration,
} from "@google/genai";
import { prisma } from "@/lib/db";
import { getStockAlerts } from "./stock-alerts";
import { getFinanceOverview } from "./finance";
<<<<<<< HEAD
=======
import { GoogleGenAI } from "@google/genai";
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)

const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ];

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
export interface AssistantContext {
<<<<<<< HEAD
<<<<<<< HEAD
  orgId: string;
=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
  orgId: string;
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
  orgName: string;
  nicheLabel: string;
  modules: string[];
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
// ---------------------------------------------------------------------------
// Widgets: dados estruturados que o agente devolve para a UI renderizar
// (cards de KPI, tabelas, listas de alerta, comparações e mini-gráficos).
// ---------------------------------------------------------------------------
export type Widget =
  | {
      type: "kpi";
      title: string;
      period?: string;
      items: { label: string; value: string; sub?: string }[];
    }
  | { type: "table"; title: string; columns: string[]; rows: string[][] }
  | {
      type: "list";
      title: string;
      items: { title: string; sub?: string; tone?: "danger" | "warn" | "ok" }[];
    }
  | {
      type: "compare";
      title: string;
      metric: string;
      a: { label: string; value: string };
      b: { label: string; value: string };
      deltaPct: number;
    }
  | { type: "bars"; title: string; bars: { label: string; value: number; display: string }[] };

type Result =
  | { ok: true; reply: string; widgets: Widget[] }
  | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n > 0 ? "+" : ""}${round2(n)}%`;

// ---------------------------------------------------------------------------
// Períodos em linguagem natural → intervalo [since, until)
// ---------------------------------------------------------------------------
type PeriodId =
  | "hoje"
  | "ontem"
  | "esta_semana"
  | "semana_passada"
  | "este_mes"
  | "mes_passado"
  | "ultimos_7_dias"
  | "ultimos_30_dias";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7; // 0 = segunda
  return addDays(x, -wd);
}

function periodRange(period: PeriodId): {
  since: Date;
  until: Date;
  label: string;
} {
  const today = startOfDay(new Date());
  switch (period) {
    case "hoje":
      return { since: today, until: addDays(today, 1), label: "hoje" };
    case "ontem":
      return { since: addDays(today, -1), until: today, label: "ontem" };
    case "esta_semana": {
      const m = mondayOf(today);
      return { since: m, until: addDays(m, 7), label: "esta semana" };
    }
    case "semana_passada": {
      const m = mondayOf(today);
      return { since: addDays(m, -7), until: m, label: "semana passada" };
    }
    case "este_mes": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        since: s,
        until: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        label: "este mês",
      };
    }
    case "mes_passado": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        since: s,
        until: new Date(today.getFullYear(), today.getMonth(), 1),
        label: "mês passado",
      };
    }
    case "ultimos_7_dias":
      return { since: addDays(today, -6), until: addDays(today, 1), label: "últimos 7 dias" };
    case "ultimos_30_dias":
    default:
      return { since: addDays(today, -29), until: addDays(today, 1), label: "últimos 30 dias" };
  }
}

// ---------------------------------------------------------------------------
// Métricas de vendas (com lucro) num intervalo
// ---------------------------------------------------------------------------
async function salesMetrics(org: string, since: Date, until: Date) {
  const [sales, products] = await Promise.all([
    prisma.sale.findMany({
      where: { organizationId: org, createdAt: { gte: since, lt: until } },
      include: { items: true },
    }),
    prisma.product.findMany({
      where: { organizationId: org },
      select: { id: true, cost: true },
    }),
  ]);
  const costById = new Map(products.map((p) => [p.id, p.cost]));

  let faturamento = 0;
  let itens = 0;
  let cmv = 0;
  for (const s of sales) {
    faturamento += s.total;
    itens += s.itemsCount;
    for (const it of s.items) {
      const c = it.productId ? costById.get(it.productId) ?? 0 : 0;
      cmv += c * it.quantity;
    }
  }
  const vendas = sales.length;
  const lucroBruto = faturamento - cmv;
  return {
    faturamento: round2(faturamento),
    vendas,
    itens,
    ticketMedio: round2(vendas ? faturamento / vendas : 0),
    cmv: round2(cmv),
    lucroBruto: round2(lucroBruto),
    margem: faturamento > 0 ? round2((lucroBruto / faturamento) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// FERRAMENTAS (cada uma devolve um texto compacto para o modelo + um widget)
// ---------------------------------------------------------------------------
type ToolOut = { data: unknown; widget?: Widget };

const TOOLS: Record<
  string,
  (org: string, args: Record<string, unknown>) => Promise<ToolOut>
> = {
  async consultar_vendas(org, args) {
    const period = (args.period as PeriodId) || "hoje";
    const { since, until, label } = periodRange(period);
    const m = await salesMetrics(org, since, until);
    return {
      data: { periodo: label, ...m },
      widget: {
        type: "kpi",
        title: "Vendas",
        period: label,
        items: [
          { label: "Faturamento", value: brl(m.faturamento) },
          { label: "Vendas", value: String(m.vendas) },
          { label: "Ticket médio", value: brl(m.ticketMedio) },
          { label: "Itens vendidos", value: String(m.itens) },
        ],
      },
    };
  },

  async consultar_lucro(org, args) {
    const period = (args.period as PeriodId) || "este_mes";
    const { since, until, label } = periodRange(period);
    const m = await salesMetrics(org, since, until);
    const payables = await prisma.financialEntry.findMany({
      where: {
        organizationId: org,
        kind: "pagar",
        dueDate: { gte: since, lt: until },
      },
      select: { amount: true },
    });
    const despesas = round2(payables.reduce((a, p) => a + p.amount, 0));
    const resultado = round2(m.lucroBruto - despesas);
    return {
      data: {
        periodo: label,
        receita: m.faturamento,
        cmv: m.cmv,
        lucroBruto: m.lucroBruto,
        margem: m.margem,
        despesas,
        resultadoLiquido: resultado,
      },
      widget: {
        type: "kpi",
        title: "Lucro",
        period: label,
        items: [
          { label: "Receita", value: brl(m.faturamento) },
          { label: "Lucro bruto", value: brl(m.lucroBruto), sub: `Margem ${m.margem}%` },
          { label: "Despesas", value: brl(despesas) },
          { label: "Resultado", value: brl(resultado) },
        ],
      },
    };
  },

  async comparar_vendas(org, args) {
    const a = periodRange((args.period_a as PeriodId) || "este_mes");
    const b = periodRange((args.period_b as PeriodId) || "mes_passado");
    const metric = (args.metric as string) || "faturamento";
    const [ma, mb] = await Promise.all([
      salesMetrics(org, a.since, a.until),
      salesMetrics(org, b.since, b.until),
    ]);
    const pick = (m: Awaited<ReturnType<typeof salesMetrics>>) =>
      metric === "lucro" ? m.lucroBruto : metric === "vendas" ? m.vendas : m.faturamento;
    const va = pick(ma);
    const vb = pick(mb);
    const deltaPct = vb > 0 ? round2(((va - vb) / vb) * 100) : 0;
    const fmt = (v: number) => (metric === "vendas" ? String(v) : brl(v));
    const metricLabel =
      metric === "lucro" ? "Lucro bruto" : metric === "vendas" ? "Nº de vendas" : "Faturamento";
    return {
      data: {
        metrica: metricLabel,
        [a.label]: fmt(va),
        [b.label]: fmt(vb),
        variacaoPct: deltaPct,
      },
      widget: {
        type: "compare",
        title: "Comparação",
        metric: metricLabel,
        a: { label: a.label, value: fmt(va) },
        b: { label: b.label, value: fmt(vb) },
        deltaPct,
      },
    };
  },

  async produtos_mais_vendidos(org, args) {
    const period = (args.period as PeriodId) || "ultimos_30_dias";
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
    const { since, until, label } = periodRange(period);
    const items = await prisma.saleItem.findMany({
      where: { sale: { organizationId: org, createdAt: { gte: since, lt: until } } },
      select: { name: true, quantity: true, unitPrice: true },
    });
    const agg = new Map<string, { qty: number; revenue: number }>();
    for (const it of items) {
      const e = agg.get(it.name) ?? { qty: 0, revenue: 0 };
      e.qty += it.quantity;
      e.revenue += it.quantity * it.unitPrice;
      agg.set(it.name, e);
    }
    const top = [...agg.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: round2(v.revenue) }))
      .sort((x, y) => y.qty - x.qty)
      .slice(0, limit);
    return {
      data: { periodo: label, produtos: top },
      widget: {
        type: "table",
        title: `Produtos mais vendidos — ${label}`,
        columns: ["#", "Produto", "Qtd", "Receita"],
        rows: top.map((p, i) => [String(i + 1), p.name, String(p.qty), brl(p.revenue)]),
      },
    };
  },

  async melhores_clientes(org, args) {
    const days = Math.min(Math.max(Number(args.days) || 30, 1), 365);
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
    const since = addDays(startOfDay(new Date()), -(days - 1));
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: org,
        customerId: { not: null },
        createdAt: { gte: since },
      },
      select: { customerId: true, total: true, customer: { select: { name: true } } },
    });
    const agg = new Map<string, { name: string; orders: number; total: number }>();
    for (const s of sales) {
      const k = s.customerId as string;
      const e = agg.get(k) ?? { name: s.customer?.name ?? "—", orders: 0, total: 0 };
      e.orders += 1;
      e.total += s.total;
      agg.set(k, e);
    }
    const top = [...agg.values()]
      .map((v) => ({ ...v, total: round2(v.total) }))
      .sort((x, y) => y.total - x.total)
      .slice(0, limit);
    return {
      data: { dias: days, clientes: top },
      widget: {
        type: "table",
        title: `Melhores clientes — últimos ${days} dias`,
        columns: ["#", "Cliente", "Compras", "Total"],
        rows: top.map((c, i) => [String(i + 1), c.name, String(c.orders), brl(c.total)]),
      },
    };
  },

  async estoque_critico(org) {
    const alerts = await getStockAlerts(org, 14);
    const crit = alerts.filter((a) => a.level !== "atencao" || a.stock <= 5).slice(0, 12);
    return {
      data: {
        total: alerts.length,
        itens: crit.map((a) => ({
          produto: a.name,
          estoque: a.stock,
          diasRestantes: a.daysLeft,
          nivel: a.level,
          sugestaoReposicao: a.suggestedReorder,
        })),
      },
      widget: {
        type: "list",
        title: "Estoque crítico",
        items: crit.map((a) => ({
          title: a.name,
          sub:
            a.stock <= 0
              ? "Sem estoque · repor " + a.suggestedReorder + " un"
              : `${a.stock} un` +
                (a.daysLeft != null ? ` · ~${a.daysLeft} dias` : "") +
                ` · repor ${a.suggestedReorder} un`,
          tone: a.level === "rompido" || a.level === "critico" ? "danger" : "warn",
        })),
      },
    };
  },

  async pedidos_pendentes_fornecedores(org) {
    const orders = await prisma.purchaseOrder.findMany({
      where: { organizationId: org, status: "enviado" },
      include: { supplier: { select: { name: true } } },
    });
    const agg = new Map<string, { name: string; pedidos: number; valor: number }>();
    for (const o of orders) {
      const e = agg.get(o.supplierId) ?? {
        name: o.supplier?.name ?? "—",
        pedidos: 0,
        valor: 0,
      };
      e.pedidos += 1;
      e.valor += o.total;
      agg.set(o.supplierId, e);
    }
    const rows = [...agg.values()]
      .map((v) => ({ ...v, valor: round2(v.valor) }))
      .sort((a, b) => b.pedidos - a.pedidos);
    return {
      data: { totalPedidosAbertos: orders.length, fornecedores: rows },
      widget: {
        type: "table",
        title: "Pedidos pendentes por fornecedor",
        columns: ["Fornecedor", "Pedidos", "Valor"],
        rows: rows.map((r) => [r.name, String(r.pedidos), brl(r.valor)]),
      },
    };
  },

  async contas_a_vencer(org, args) {
    const when = (args.when as string) || "hoje"; // hoje | atrasadas | proximos_7_dias
    const kind = (args.kind as string) || "pagar"; // pagar | receber | ambos
    const today = startOfDay(new Date());
    let range: { gte?: Date; lt?: Date; lte?: Date } = {};
    let title = "Contas a pagar de hoje";
    if (when === "atrasadas") {
      range = { lt: today };
      title = "Contas vencidas";
    } else if (when === "proximos_7_dias") {
      range = { gte: today, lt: addDays(today, 7) };
      title = "Contas dos próximos 7 dias";
    } else {
      range = { gte: today, lt: addDays(today, 1) };
      title = "Contas que vencem hoje";
    }
    const entries = await prisma.financialEntry.findMany({
      where: {
        organizationId: org,
        status: "pendente",
        ...(kind === "ambos" ? {} : { kind }),
        dueDate: range,
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    });
    const total = round2(entries.reduce((a, e) => a + e.amount, 0));
    return {
      data: {
        total,
        quantidade: entries.length,
        contas: entries.map((e) => ({
          descricao: e.description,
          tipo: e.kind,
          valor: e.amount,
          vencimento: e.dueDate.toISOString().slice(0, 10),
        })),
      },
      widget: {
        type: "list",
        title: `${title} — total ${brl(total)}`,
        items: entries.map((e) => ({
          title: e.description,
          sub: `${e.kind === "pagar" ? "A pagar" : "A receber"} · ${brl(e.amount)} · vence ${e.dueDate.toLocaleDateString("pt-BR")}`,
          tone: e.kind === "pagar" ? "warn" : "ok",
        })),
      },
    };
  },

  async resumo_financeiro(org) {
    const ov = await getFinanceOverview(org);
    return {
      data: ov.kpis,
      widget: {
        type: "kpi",
        title: "Financeiro",
        items: [
          { label: "A receber", value: brl(ov.kpis.aReceber) },
          { label: "A pagar", value: brl(ov.kpis.aPagar) },
          { label: "Saldo previsto", value: brl(ov.kpis.saldoPrevisto) },
          { label: "Vencidos", value: String(ov.kpis.vencidos) },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Declarações das ferramentas para o Gemini (function calling)
// ---------------------------------------------------------------------------
const PERIOD_ENUM = [
  "hoje",
  "ontem",
  "esta_semana",
  "semana_passada",
  "este_mes",
  "mes_passado",
  "ultimos_7_dias",
  "ultimos_30_dias",
];

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "consultar_vendas",
    description:
      "Consulta faturamento, número de vendas, ticket médio e itens vendidos num período. Use para perguntas como 'qual meu faturamento ontem', 'quanto vendi este mês'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, enum: PERIOD_ENUM },
      },
      required: ["period"],
    },
  },
  {
    name: "consultar_lucro",
    description:
      "Calcula receita, CMV, lucro bruto, margem, despesas e resultado líquido de um período. Use para 'qual meu lucro deste mês'.",
    parameters: {
      type: Type.OBJECT,
      properties: { period: { type: Type.STRING, enum: PERIOD_ENUM } },
      required: ["period"],
    },
  },
  {
    name: "comparar_vendas",
    description:
      "Compara uma métrica (faturamento, lucro ou vendas) entre dois períodos e calcula a variação percentual. Use para 'compare as vendas deste mês com o mês passado'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_a: { type: Type.STRING, enum: PERIOD_ENUM },
        period_b: { type: Type.STRING, enum: PERIOD_ENUM },
        metric: { type: Type.STRING, enum: ["faturamento", "lucro", "vendas"] },
      },
      required: ["period_a", "period_b"],
    },
  },
  {
    name: "produtos_mais_vendidos",
    description:
      "Lista os produtos mais vendidos (por quantidade) num período. Use para 'qual produto mais vendeu na semana', 'os 10 produtos mais vendidos'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, enum: PERIOD_ENUM },
        limit: { type: Type.NUMBER },
      },
      required: ["period"],
    },
  },
  {
    name: "melhores_clientes",
    description:
      "Lista os clientes que mais compraram (por valor total) nos últimos N dias. Use para 'quais clientes compraram mais nos últimos 30 dias'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: { type: Type.NUMBER },
        limit: { type: Type.NUMBER },
      },
    },
  },
  {
    name: "estoque_critico",
    description:
      "Lista produtos com estoque baixo, rompido ou em risco de ruptura, com sugestão de reposição. Use para 'quais produtos estão com estoque crítico'.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "pedidos_pendentes_fornecedores",
    description:
      "Mostra quantos pedidos de compra estão pendentes (enviados, não recebidos) por fornecedor. Use para 'qual fornecedor está com mais pedidos pendentes'.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "contas_a_vencer",
    description:
      "Lista contas a pagar/receber pendentes que vencem hoje, estão atrasadas, ou vencem nos próximos 7 dias. Use para 'quais contas vencem hoje'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        when: { type: Type.STRING, enum: ["hoje", "atrasadas", "proximos_7_dias"] },
        kind: { type: Type.STRING, enum: ["pagar", "receber", "ambos"] },
      },
    },
  },
  {
    name: "resumo_financeiro",
    description:
      "Resumo financeiro geral: total a receber, a pagar, saldo previsto e contas vencidas.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

const SYSTEM = (ctx: AssistantContext) => `Você é o ENDURANCE IA, um gerente virtual operacional do ERP, para o negócio "${ctx.orgName}" (nicho ${ctx.nicheLabel}). Módulos ativos: ${ctx.modules.join(", ") || "—"}.

Seu papel: responder perguntas consultando os DADOS REAIS do negócio através das ferramentas disponíveis, e gerar análises e insights úteis. Você é um analista, não um manual.

REGRAS:
- Para QUALQUER pergunta sobre números do negócio (faturamento, vendas, lucro, produtos, clientes, estoque, fornecedores, contas), SEMPRE chame a ferramenta adequada. NUNCA mande o usuário "ir até o módulo X" ou "clicar em Y" — você mesmo busca e responde com os números.
- Entenda linguagem natural e erros de digitação. Converta o tempo da pergunta para o período certo (ex.: "ontem" → period=ontem; "esse mês" → este_mes; "semana" → esta_semana ou ultimos_7_dias).
- Depois de obter os dados, responda em português do Brasil de forma BREVE e direta, já com os valores. Acrescente 1 insight curto quando houver algo relevante (ex.: queda/alta expressiva, estoque rompido, conta atrasada).
- Os cards/tabelas já são exibidos automaticamente na interface a partir das ferramentas; não repita longas listas no texto — comente o destaque.
- Se a pergunta não for sobre dados (ex.: como usar o sistema), responda normalmente e de forma breve.
- Não invente números: se uma ferramenta retornar vazio, diga que não há dados no período.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(e: unknown): number {
  return (e as { status?: number })?.status ?? 0;
}

/** Erro de REDE (vale re-tentar). Não inclui 429 — quota não se resolve com retry. */
function isNetworkError(e: unknown): boolean {
  const code =
    (e as { code?: string })?.code ||
    (e as { cause?: { code?: string } })?.cause?.code;
  const msg = String((e as Error)?.message || "");
  return (
    [500, 502, 503, 504].includes(statusOf(e)) ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    /fetch failed|timeout|network|socket/i.test(msg)
  );
}

/** Agente do assistente: function calling do Gemini sobre os dados do negócio. */
<<<<<<< HEAD
=======
type Result = { ok: true; reply: string } | { ok: false; error: string };

/** Assistente operacional (chat) do ENDURANCE, via Gemini. */
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
export async function askAssistant(
  ctx: AssistantContext,
  messages: ChatMsg[],
): Promise<Result> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey)
    return {
      ok: false,
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
      error: "O assistente precisa de uma chave de IA (GEMINI_API_KEY) configurada.",
    };

  const contents: Content[] = messages
<<<<<<< HEAD
=======
      error:
        "O assistente precisa de uma chave de IA (GEMINI_API_KEY) configurada.",
    };

  const sys = `Você é o assistente operacional do ENDURANCE, um ERP/sistema de gestão para pequenos negócios.
Empresa do operador: "${ctx.orgName}" — nicho ${ctx.nicheLabel}. Módulos ativos: ${ctx.modules.join(", ") || "—"}.
Ajude o operador com: como usar o sistema (PDV/caixa, cadastro de produtos, estoque, vendas, clientes, relatórios), processos do dia a dia e treinamento de novos operadores.
Dicas reais do sistema: o caixa fica no módulo PDV (botão "Iniciar venda", leitura por código de barras, desconto em R$ ou %, formas de pagamento com split, e tela cheia); produtos e estoque ficam nos módulos correspondentes; o painel executivo fica em "Relatórios & painel".
Regras: responda em português do Brasil, de forma BREVE e prática (use passos curtos quando fizer sentido). Foque no uso do sistema. Se a pergunta fugir do escopo, redirecione gentilmente.`;

  const contents = messages
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  while (contents.length && contents[0].role === "model") contents.shift();
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
  if (contents.length === 0) return { ok: false, error: "Envie uma pergunta." };

  const widgets: Widget[] = [];
  let rateLimited = false;

  try {
    const ai = new GoogleGenAI({ apiKey });

    for (const model of GEMINI_MODELS) {
      try {
        // Laço de agente: o modelo pode chamar ferramentas várias vezes.
        for (let step = 0; step < 5; step++) {
          // Re-tenta em erros transitórios de rede/limite (o tier grátis e a
          // conexão ao Gemini às vezes oscilam).
          let resp;
          let lastErr: unknown;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              resp = await ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction: SYSTEM(ctx),
                  temperature: 0.3,
                  maxOutputTokens: 1200,
                  tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
                },
              });
              lastErr = null;
              break;
            } catch (e) {
              lastErr = e;
              if (isNetworkError(e) && attempt < 2) {
                await sleep(700 * (attempt + 1));
                continue;
              }
              throw e;
            }
          }
          if (!resp) throw lastErr;

          const calls = resp.functionCalls ?? [];
          if (calls.length > 0) {
            // Registra o turno do modelo (com as chamadas de função).
            const modelContent = resp.candidates?.[0]?.content;
            if (modelContent) contents.push(modelContent);

            const responseParts: Part[] = [];
            for (const call of calls) {
              const fn = TOOLS[call.name ?? ""];
              let out: ToolOut;
              try {
                out = fn
                  ? await fn(ctx.orgId, (call.args ?? {}) as Record<string, unknown>)
                  : { data: { erro: "ferramenta desconhecida" } };
              } catch (e) {
                console.error("[assistant:tool]", call.name, e);
                out = { data: { erro: "falha ao consultar" } };
              }
              if (out.widget) widgets.push(out.widget);
              responseParts.push({
                functionResponse: {
                  name: call.name ?? "",
                  response: { result: out.data },
                },
              });
            }
            contents.push({ role: "user", parts: responseParts });
            continue; // volta ao modelo com os resultados
          }

          // Sem chamadas → resposta final em texto.
          const reply = (resp.text || "").trim();
          if (reply) return { ok: true, reply, widgets };
          // Modelo não respondeu texto mas trouxe widgets → devolve mesmo assim.
          if (widgets.length > 0)
            return { ok: true, reply: "Aqui está o que encontrei:", widgets };
          break; // resposta vazia deste modelo → sai do laço de passos
        }
        if (widgets.length > 0)
          return { ok: true, reply: "Aqui está o que encontrei:", widgets };
        // Resposta vazia: tenta o PRÓXIMO modelo em vez de desistir.
        continue;
      } catch (e) {
        const st = statusOf(e);
        if (st === 429) {
          rateLimited = true; // cota/limite — tenta outro modelo
          continue;
        }
        if ([404, 500, 502, 503, 504].includes(st)) continue; // tenta próximo modelo
        throw e;
      }
    }
    if (rateLimited)
      return {
        ok: false,
        error:
          "Limite de uso da IA atingido (cota gratuita do Gemini). Aguarde cerca de um minuto e tente de novo — ou configure uma chave com mais cota no .env.",
      };
<<<<<<< HEAD
=======
  if (contents.length === 0)
    return { ok: false, error: "Envie uma pergunta." };

  try {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of GEMINI_MODELS) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sys,
            temperature: 0.6,
            maxOutputTokens: 700,
          },
        });
        const reply = (resp.text || "").trim();
        if (reply) return { ok: true, reply };
        break;
      } catch (e) {
        const st = (e as { status?: number })?.status;
        if ([404, 429, 500, 503].includes(st ?? 0)) continue;
        throw e;
      }
    }
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
    return {
      ok: false,
      error: "Não consegui responder agora. Tente novamente em instantes.",
    };
  } catch (err) {
    console.error("[assistant] erro:", err);
    return { ok: false, error: "Falha ao falar com a IA." };
  }
}
