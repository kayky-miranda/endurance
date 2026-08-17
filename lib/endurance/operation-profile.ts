/**
 * Leitura da operação a partir da descrição livre — regra PURA, sem rede.
 *
 * O classificador de nicho responde "que ramo é este?" e escolhe os módulos.
 * Ele não responde o que a tela de análise precisa mostrar: que TIPO de
 * operação é (indústria, distribuidora, serviço...), se vende para empresa ou
 * para consumidor, e quais áreas apareceram no texto.
 *
 * Por que aqui e não no prompt da IA: esta leitura precisa funcionar igual
 * com a IA ligada ou desligada. Um resumo que muda de forma conforme a chave
 * de API esteja configurada é pior do que um resumo simples, e ninguém
 * consegue testar o primeiro. Além disso, afirmar "modelo B2B" é uma
 * afirmação sobre a empresa do cliente: ela precisa sair de algo que ele
 * escreveu, não de uma inferência solta.
 *
 * Tudo o que não estiver no texto fica de fora. Preferimos um resumo curto e
 * correto a um resumo completo e inventado.
 */

/** Normaliza para busca: minúsculas, sem acento. */
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const has = (t: string, termos: string[]) => termos.some((k) => t.includes(k));

export type OperationModel = "B2B" | "B2C" | "B2B e B2C" | "";

export interface OperationArea {
  id: string;
  label: string;
}

export interface OperationProfile {
  /** Tipo de operação identificado. Vazio quando o texto não deixa claro. */
  kind: string;
  model: OperationModel;
  areas: OperationArea[];
  /** Frase sobre as necessidades identificadas. Vazia se nada foi identificado. */
  needs: string;
  /** Quantidade aproximada de pessoas, quando citada no texto. */
  headcount: number | null;
  /** Quantidade de unidades/filiais, quando citada. */
  units: number | null;
}

/**
 * Tipos de operação. A ordem importa: o primeiro que casa vence, então os
 * mais específicos vêm antes. "Distribuidora" antes de "comércio" porque
 * quem distribui quase sempre também diz que vende.
 */
const KINDS: { kind: string; termos: string[] }[] = [
  {
    kind: "Indústria",
    termos: [
      "industria", "fabrica", "fabricamos", "fabricacao", "producao propria",
      "linha de producao", "manufatura", "montagem", "usinagem", "confeccao",
      "produzimos",
    ],
  },
  {
    kind: "Distribuidora",
    termos: ["distribuidora", "distribuicao", "distribuimos", "representacao comercial"],
  },
  {
    kind: "Atacado",
    termos: ["atacado", "atacadista", "atacarejo"],
  },
  {
    kind: "Operação logística",
    termos: [
      "transportadora", "logistica", "frota", "entregas", "armazenagem",
      "centro de distribuicao", "fulfillment",
    ],
  },
  {
    kind: "Prestação de serviços",
    termos: [
      "prestador", "prestamos servico", "prestacao de servico", "consultoria",
      "assessoria", "agencia", "escritorio", "clinica", "consultorio",
      "atendimento", "manutencao", "assistencia tecnica", "obra", "instalacao",
    ],
  },
  {
    kind: "Comércio",
    termos: [
      "loja", "comercio", "mercado", "mercadinho", "supermercado", "varejo",
      "mercearia", "padaria", "farmacia", "papelaria", "boutique", "balcao",
      "e-commerce", "ecommerce", "marketplace",
    ],
  },
];

/** Áreas de gestão. Só entram as que o texto realmente encosta. */
const AREAS: { id: string; label: string; termos: string[] }[] = [
  {
    id: "producao",
    label: "Produção",
    termos: ["producao", "fabrica", "fabricacao", "manufatura", "montagem", "pcp", "ordem de producao"],
  },
  {
    id: "estoque",
    label: "Estoque",
    termos: ["estoque", "almoxarifado", "inventario", "armazenagem", "deposito"],
  },
  {
    id: "compras",
    label: "Compras",
    termos: ["compras", "fornecedor", "fornecedores", "cotacao", "suprimentos", "insumos", "materia-prima", "materia prima"],
  },
  {
    id: "vendas",
    label: "Vendas",
    termos: ["venda", "vendas", "vendemos", "pedido", "pedidos", "orcamento", "proposta", "comercial"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    termos: ["financeiro", "caixa", "fluxo de caixa", "contas a pagar", "contas a receber", "cobranca", "faturamento", "boleto"],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    termos: ["fiscal", "nota fiscal", "nfe", "nf-e", "nfce", "nfc-e", "nfse", "sped", "tributa", "imposto"],
  },
  {
    id: "logistica",
    label: "Logística",
    termos: ["logistica", "entrega", "entregas", "frete", "transporte", "expedicao", "frota", "romaneio"],
  },
  {
    id: "clientes",
    label: "Clientes",
    termos: ["cliente", "clientes", "crm", "carteira de clientes", "pos-venda", "relacionamento"],
  },
  {
    id: "agenda",
    label: "Agenda e atendimento",
    termos: ["agenda", "agendamento", "consulta", "consultas", "sessao", "horario", "atendimentos"],
  },
  {
    id: "contratos",
    label: "Contratos",
    termos: ["contrato", "contratos", "recorrencia", "mensalidade", "assinatura"],
  },
];

const B2B = [
  "b2b", "outras empresas", "para empresas", "pessoa juridica", "revenda",
  "revendedores", "lojistas", "atacado", "atacadista", "distribuidora",
  "industrias", "corporativo",
];
const B2C = [
  "b2c", "consumidor final", "consumidores", "publico final", "pessoa fisica",
  "balcao", "varejo", "cliente final", "loja fisica",
];

/** Primeiro número que aparece perto de uma palavra sobre pessoas. */
function findCount(t: string, termos: string[]): number | null {
  for (const termo of termos) {
    // "50 funcionarios", "aproximadamente 50 funcionarios", "50 colaboradores"
    const re = new RegExp(`(\\d{1,6})\\s*(?:[a-z\\s]{0,15})?${termo}`);
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

export function readOperation(description: string): OperationProfile {
  const t = norm(description);

  const kind = KINDS.find((k) => has(t, k.termos))?.kind ?? "";

  const b2b = has(t, B2B);
  const b2c = has(t, B2C);
  const model: OperationModel =
    b2b && b2c ? "B2B e B2C" : b2b ? "B2B" : b2c ? "B2C" : "";

  const areas = AREAS.filter((a) => has(t, a.termos)).map((a) => ({
    id: a.id,
    label: a.label,
  }));

  const headcount = findCount(t, [
    "funcionario", "colaborador", "empregado", "pessoa", "profissional",
  ]);
  const units = findCount(t, ["filial", "filiais", "unidade", "unidades", "loja"]);

  return { kind, model, areas, needs: needsSentence(areas), headcount, units };
}

/**
 * Frase de necessidades montada a partir das áreas encontradas. Não inventa
 * dor: só nomeia o que o próprio cliente mencionou.
 */
function needsSentence(areas: OperationArea[]): string {
  if (areas.length === 0) return "";
  const nomes = areas.map((a) => a.label.toLowerCase());
  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Controle de ${lista}, com as informações conectadas entre as áreas.`;
}

/** Há material suficiente para montar a tela de resumo? */
export function hasProfile(p: OperationProfile): boolean {
  return Boolean(p.kind || p.model || p.areas.length > 0);
}

/**
 * Módulos que cada área de gestão implica — INDEPENDENTE do ramo.
 *
 * Os módulos operacionais nasceram todos dentro do ramo "mercado_varejo",
 * porque foi o primeiro nicho a existir. O efeito colateral aparecia no
 * cadastro de qualquer empresa que não fosse loja: uma indústria que dizia
 * controlar estoque, compras, produção e fiscal era classificada como "outro"
 * e entrava na plataforma só com os sete módulos core, sem nada do que a
 * tela de análise tinha acabado de listar. Com a IA desligada acontecia o
 * inverso — as mesmas palavras casavam com varejo e ela ganhava PDV e
 * fechamento de caixa, que nunca vai usar.
 *
 * Aqui a ligação passa a ser área → módulo. O ramo continua existindo para
 * dar nome e sugerir um pacote inicial; ele deixa de ser a porta que decide
 * o que a empresa pode ligar.
 *
 * Estoque e compras trazem seus vizinhos diretos (movimentações, cadastro de
 * produtos, fornecedores) porque um sem o outro não opera. PDV e fechamento
 * de caixa NÃO entram por "vendas": venda de balcão é uma forma específica de
 * vender, não a única.
 */
const AREA_MODULES: Record<string, string[]> = {
  producao: ["produtos", "estoque", "movimentacoes"],
  estoque: ["estoque", "movimentacoes", "produtos", "conferencia", "transferencias"],
  compras: ["compras", "fornecedores", "pedidos_compra", "recebimento", "cotacoes"],
  vendas: ["crm", "precificacao"],
  financeiro: ["financeiro"],
  fiscal: ["nfe", "nfce"],
  logistica: ["transferencias", "movimentacoes"],
  clientes: ["crm"],
  agenda: ["agenda_consultas"],
  contratos: ["financeiro"],
};

/**
 * Módulos sugeridos a partir das áreas identificadas na descrição.
 * Devolve ids do catálogo, sem repetir e sem inventar: área que não mapeia
 * para nada simplesmente não contribui.
 */
export function modulesForAreas(areas: OperationArea[]): string[] {
  const out = new Set<string>();
  for (const a of areas) for (const id of AREA_MODULES[a.id] ?? []) out.add(id);
  return [...out];
}
