/**
 * Catálogo de nichos e módulos do ENDURANCE (MVP).
 *
 * Esta é a "fonte da verdade" compartilhada por três consumidores:
 *  - o prompt da IA de onboarding (lista os módulos válidos),
 *  - o classificador offline por palavras-chave,
 *  - a interface (rótulos e descrições dos módulos sugeridos).
 *
 * No MVP focamos em 4 nichos. O nicho "mercado_varejo" é o que vamos
 * aprofundar primeiro. A IA só LIGA módulos deste catálogo — não inventa
 * estrutura nova (isso é um "registry de módulos", não schema dinâmico).
 */

export type NicheId =
  | "mercado_varejo"
  | "academia"
  | "cabelereiro"
  | "nutricionista"
  | "psicologia"
  | "clinica";

/** Inclui "outro" para quando a descrição não casa com nenhum nicho do MVP. */
export type NicheOrOther = NicheId | "outro";

export interface Niche {
  id: NicheId;
  label: string;
  /** Palavras-chave usadas pelo classificador offline (sem acento, minúsculas). */
  keywords: string[];
  /** Frase de exemplo mostrada na interface como atalho. */
  example: string;
  /**
   * Oferecido a QUEM ESTÁ SE CADASTRANDO agora.
   *
   * `false` NÃO remove o ramo do catálogo — remover quebraria as empresas que
   * já o escolheram: `activeModuleIds` deixaria de reconhecer o ramo, os
   * módulos delas sumiriam da barra lateral e `nicheLabel` devolveria o id cru.
   * Só deixa de aparecer para contratos novos.
   */
  available?: boolean;
}

export const NICHES: Niche[] = [
  {
    id: "mercado_varejo",
    label: "Mercado / Varejo",
    keywords: [
      "mercado",
      "mercadinho",
      "supermercado",
      "varejo",
      "loja",
      "comercio",
      "comercio",
      "minimercado",
      "armazem",
      "mercearia",
      "conveniencia",
      "atacado",
      "bazar",
      "padaria",
      "panificadora",
      "confeitaria",
      "acougue",
      "hortifruti",
      "quitanda",
      "farmacia",
      "papelaria",
      "distribuidora",
    ],
    example: "Tenho um mercadinho de bairro em Campinas, SP.",
  },
  {
    id: "academia",
    label: "Academia",
    keywords: [
      "academia",
      "musculacao",
      "crossfit",
      "treino",
      "personal",
      "fitness",
      "ginastica",
      "box",
    ],
    example: "Abri uma academia de musculação em São Paulo.",
    // Fora da oferta: 5 dos 8 módulos do ramo (mensalidades, planos,
    // equipamentos, catraca, cobrança automática) ainda estão em construção —
    // e são praticamente o modelo de negócio de uma academia. Vender agora
    // seria entregar "Em construção" onde deveria estar o trabalho do cliente,
    // no pior momento possível: depois de ele já ter pago.
    available: false,
  },
  {
    id: "cabelereiro",
    label: "Cabeleireiro / Salão",
    keywords: [
      "cabele",
      "cabeleireiro",
      "salao",
      "barbearia",
      "barbeiro",
      "beleza",
      "estetica",
      "manicure",
    ],
    example: "Sou dono de um salão de beleza em Belo Horizonte.",
    // Fora da oferta: os 6 módulos do ramo estão em construção. Um salão que
    // contratasse hoje receberia apenas o núcleo — nada de agenda, comanda,
    // comissão ou fidelidade. Não é lançamento, é promessa.
    available: false,
  },
  {
    id: "nutricionista",
    label: "Nutricionista",
    keywords: [
      "nutri",
      "nutricionista",
      "nutricao",
      "dieta",
      "alimentar",
      "consultorio nutri",
    ],
    example: "Sou nutricionista e atendo em consultório no Recife.",
  },
  {
    id: "psicologia",
    label: "Psicologia",
    keywords: [
      "psico",
      "psicologo",
      "psicologa",
      "psicologia",
      "terapia",
      "terapeuta",
      "psicoterapia",
      "psicanalise",
    ],
    example: "Sou psicólogo e atendo em consultório em Curitiba.",
  },
  {
    id: "clinica",
    label: "Clínica / Consultório",
    keywords: [
      "clinica",
      "consultorio",
      "medico",
      "medica",
      "fisioterapia",
      "fisioterapeuta",
      "odonto",
      "dentista",
      "fonoaudiologia",
      "terapia ocupacional",
    ],
    example: "Tenho uma clínica de fisioterapia em Salvador.",
  },
];

export interface ModuleDef {
  id: string;
  label: string;
  description: string;
  /** "core" = todos os nichos. Caso contrário, lista os nichos onde aparece. */
  scope: "core" | NicheId[];
}

export const MODULES: ModuleDef[] = [
  // ---- Core (compartilhado por todos os nichos) ----
  {
    id: "marketing",
    label: "Marketing com IA",
    description: "Crie carrosséis profissionais para Instagram em segundos com IA.",
    scope: "core",
  },
  {
    id: "acesso",
    label: "Acesso & multiusuário",
    description: "Login, papéis e dados isolados por empresa (multi-tenant).",
    scope: "core",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Contas a pagar/receber, fluxo de caixa e conciliação.",
    scope: "core",
  },
  {
    id: "crm",
    label: "Clientes (CRM)",
    description: "Cadastro central de clientes e histórico de contato.",
    scope: "core",
  },
  {
    id: "notificacoes",
    label: "Notificações",
    description: "Mensagens automáticas por WhatsApp e e-mail.",
    scope: "core",
  },
  {
    id: "relatorios",
    label: "Relatórios & painel",
    description: "Indicadores do negócio reunidos em um painel único.",
    scope: "core",
  },
  {
    id: "importacao",
    label: "Importação em massa",
    description: "Importe fornecedores, produtos, clientes e mais via CSV/Excel.",
    scope: "core",
  },

  // ---- Mercado / Varejo ----
  {
    id: "pdv",
    label: "PDV (frente de caixa)",
    description: "Venda rápida no balcão com leitura de itens.",
    scope: ["mercado_varejo"],
  },
  {
    id: "estoque",
    label: "Controle de estoque",
    description: "Entradas, saídas e alerta de estoque baixo.",
    scope: ["mercado_varejo"],
  },
  {
    id: "movimentacoes",
    label: "Movimentações de estoque",
    description: "Razão completo do estoque: toda entrada e saída auditada.",
    scope: ["mercado_varejo"],
  },
  {
    id: "transferencias",
    label: "Transferências entre locais",
    description: "Mova estoque entre matriz, filiais e depósitos, com rastro no razão.",
    scope: ["mercado_varejo"],
  },
  {
    id: "conferencia",
    label: "Conferência de Estoque",
    description: "Contagem física com aprovação de divergências antes do ajuste.",
    scope: ["mercado_varejo"],
  },
  {
    id: "caixa",
    label: "Fechamento de caixa",
    description: "Abertura, sangria/suprimento e conferência do caixa.",
    scope: ["mercado_varejo"],
  },
  {
    id: "produtos",
    label: "Cadastro de produtos",
    description: "Catálogo com preço, custo e categorias.",
    scope: ["mercado_varejo"],
  },
  {
    id: "precificacao",
    label: "Precificação",
    description: "Margens, sugestão de preços e promoções com IA.",
    scope: ["mercado_varejo"],
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro completo de fornecedores e vínculo com produtos.",
    scope: ["mercado_varejo"],
  },

  // ---- Suprimentos / Compras (mercado/varejo) ----
  {
    id: "compras",
    label: "Compras (painel)",
    description: "Painel de suprimentos: KPIs, gastos e desempenho de compras.",
    scope: ["mercado_varejo"],
  },
  {
    id: "solicitacoes",
    label: "Solicitações de compra",
    description: "Requisição de materiais com aprovação em múltiplos níveis.",
    scope: ["mercado_varejo"],
  },
  {
    id: "aprovacoes",
    label: "Aprovações de compra",
    description: "Aprovar, rejeitar ou pedir ajustes nas solicitações.",
    scope: ["mercado_varejo"],
  },
  {
    id: "cotacoes",
    label: "Cotações",
    description: "Cotação com vários fornecedores e comparativo de propostas.",
    scope: ["mercado_varejo"],
  },
  {
    id: "pedidos_compra",
    label: "Pedidos de compra",
    description: "Emissão e acompanhamento de pedidos ao fornecedor.",
    scope: ["mercado_varejo"],
  },
  {
    id: "recebimento",
    label: "Recebimento de materiais",
    description: "Conferência de entregas, divergências e entrada no estoque.",
    scope: ["mercado_varejo"],
  },
  {
    id: "codigo_barras",
    label: "Código de barras",
    description: "Leitura e geração de códigos de barras.",
    scope: ["mercado_varejo"],
  },
  {
    id: "nfce",
    label: "Fiscal (NFC-e)",
    description: "Emissão de nota fiscal ao consumidor (modelo 65).",
    scope: ["mercado_varejo"],
  },
  {
    id: "nfe",
    label: "Emissão de NF-e",
    description: "Nota fiscal eletrônica (modelo 55).",
    scope: ["mercado_varejo"],
  },

  // ---- Academia ----
  {
    id: "alunos",
    label: "Cadastro de alunos",
    description: "Ficha do aluno, contato e situação.",
    scope: ["academia"],
  },
  {
    id: "mensalidades",
    label: "Controle de mensalidades",
    description: "Planos, vencimentos e inadimplência.",
    scope: ["academia"],
  },
  {
    id: "planos",
    label: "Planos e modalidades",
    description: "Modalidades oferecidas e preços por plano.",
    scope: ["academia"],
  },
  {
    id: "equipamentos",
    label: "Inventário de equipamentos",
    description: "Controle e manutenção de aparelhos.",
    scope: ["academia"],
  },
  {
    id: "treinos",
    label: "Fichas de treino",
    description: "Montagem de treinos por divisão (A/B/C) para o aluno.",
    scope: ["academia"],
  },
  {
    id: "avaliacao",
    label: "Avaliação física",
    description: "Registro de medidas e evolução do aluno.",
    scope: ["academia"],
  },
  {
    id: "qr_acesso",
    label: "Acesso via QR code",
    description: "Entrada na catraca por QR code do aluno.",
    scope: ["academia"],
  },
  {
    id: "chatbot_cobranca",
    label: "Chatbot de cobrança",
    description: "Lembretes e cobrança automática de mensalidade.",
    scope: ["academia"],
  },

  // ---- Cabeleireiro / Salão ----
  {
    id: "agenda",
    label: "Agenda online",
    description: "Agendamento de horários por profissional.",
    scope: ["cabelereiro"],
  },
  {
    id: "comandas",
    label: "Comandas & serviços",
    description: "Comanda por cliente com serviços e produtos.",
    scope: ["cabelereiro"],
  },
  {
    id: "comissoes",
    label: "Controle de comissões",
    description: "Comissão por profissional e por serviço.",
    scope: ["cabelereiro"],
  },
  {
    id: "estoque_produtos",
    label: "Estoque de produtos",
    description: "Produtos de revenda e uso interno.",
    scope: ["cabelereiro"],
  },
  {
    id: "fidelidade",
    label: "Programa de fidelidade",
    description: "Pontos e recompensas para clientes.",
    scope: ["cabelereiro"],
  },
  {
    id: "lembrete_whatsapp",
    label: "Lembrete via WhatsApp",
    description: "Confirmação e lembrete de horário automático.",
    scope: ["cabelereiro"],
  },

  // ---- Nutricionista ----
  {
    id: "pacientes",
    label: "Cadastro de pacientes",
    description: "Ficha completa: dados, convênio, endereço e documentos.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "prontuario",
    label: "Prontuário clínico",
    description: "Histórico clínico e anotações do paciente.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "planos_alimentares",
    label: "Planos alimentares",
    description: "Montagem e entrega de cardápios.",
    scope: ["nutricionista"],
  },
  {
    id: "agenda_consultas",
    label: "Agenda de consultas",
    description: "Marcação e controle de consultas.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "evolucao",
    label: "Evolução do paciente",
    description: "Acompanhamento de peso e metas ao longo do tempo.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "anamnese",
    label: "Anamnese digital",
    description: "Questionário inicial preenchido pelo paciente.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "confirmacao_auto",
    label: "Confirmação automática",
    description: "Confirmação de consulta por mensagem.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "recibo",
    label: "Emissão de recibo",
    description: "Recibo de atendimento para o paciente.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
  {
    id: "relatorios_clinica",
    label: "Relatórios da clínica",
    description: "Produtividade, comissões e indicadores por período.",
    scope: ["nutricionista", "psicologia", "clinica"],
  },
];

const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function moduleById(id: string): ModuleDef | undefined {
  return MODULE_BY_ID.get(id);
}

// ---------------------------------------------------------------------------
// Categorias da navegação lateral. Agrupam os módulos (e os itens fixos do
// menu) em seções na ordem abaixo. É a fonte da verdade do agrupamento da
// sidebar — adicionar um módulo a uma categoria é uma linha em MODULE_CATEGORY.
// ---------------------------------------------------------------------------
export const MODULE_CATEGORIES = [
  "Dashboards",
  "Operação",
  "Catálogo & Estoque",
  "Suprimentos",
  "Fiscal & Financeiro",
  "Administração",
] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

const MODULE_CATEGORY: Record<string, ModuleCategory> = {
  // Dashboards
  relatorios: "Dashboards",
  relatorios_clinica: "Dashboards",
  marketing: "Operação",
  // Operação
  pdv: "Operação",
  caixa: "Operação",
  crm: "Operação",
  codigo_barras: "Operação",
  agenda: "Operação",
  agenda_consultas: "Operação",
  comandas: "Operação",
  alunos: "Operação",
  treinos: "Operação",
  pacientes: "Operação",
  prontuario: "Operação",
  anamnese: "Operação",
  avaliacao: "Operação",
  evolucao: "Operação",
  qr_acesso: "Operação",
  // Catálogo & Estoque
  produtos: "Catálogo & Estoque",
  estoque: "Catálogo & Estoque",
  movimentacoes: "Catálogo & Estoque",
  conferencia: "Catálogo & Estoque",
  transferencias: "Catálogo & Estoque",
  precificacao: "Catálogo & Estoque",
  estoque_produtos: "Catálogo & Estoque",
  equipamentos: "Catálogo & Estoque",
  planos: "Catálogo & Estoque",
  planos_alimentares: "Catálogo & Estoque",
  // Suprimentos
  compras: "Suprimentos",
  fornecedores: "Suprimentos",
  solicitacoes: "Suprimentos",
  aprovacoes: "Suprimentos",
  cotacoes: "Suprimentos",
  pedidos_compra: "Suprimentos",
  recebimento: "Suprimentos",
  // Fiscal & Financeiro
  financeiro: "Fiscal & Financeiro",
  nfce: "Fiscal & Financeiro",
  nfe: "Fiscal & Financeiro",
  mensalidades: "Fiscal & Financeiro",
  comissoes: "Fiscal & Financeiro",
  recibo: "Fiscal & Financeiro",
  // Administração
  acesso: "Administração",
  notificacoes: "Administração",
  importacao: "Administração",
  fidelidade: "Administração",
  lembrete_whatsapp: "Administração",
  chatbot_cobranca: "Administração",
  confirmacao_auto: "Administração",
};

/** Categoria de um módulo (default "Operação" para qualquer não mapeado). */
export function moduleCategory(id: string): ModuleCategory {
  return MODULE_CATEGORY[id] ?? "Operação";
}

// RBAC: o gating de módulos vive em `permissions.ts` (MODULE_PERMISSION +
// canAccessModule) — permissões granulares, sem lista de módulos por papel.

export function coreModules(): ModuleDef[] {
  return MODULES.filter((m) => m.scope === "core");
}

export function modulesForNiche(niche: NicheId): ModuleDef[] {
  return MODULES.filter(
    (m) => Array.isArray(m.scope) && m.scope.includes(niche),
  );
}

/** Todos os ids válidos — usado como enum no schema de saída da IA. */
export function allModuleIds(): string[] {
  return MODULES.map((m) => m.id);
}

/**
 * Módulos ativos de um espaço — FONTE DA VERDADE única, usada tanto pela
 * navegação (`getWorkspace`) quanto pela tela de Configurações
 * (`getModulesConfig`), para as duas nunca discordarem.
 *
 * `configured` traz o que existe na tabela OrgModule (id → enabled). A regra:
 *  - tem linha  → vale o que a linha diz (o usuário decidiu);
 *  - sem linha  → vale o padrão do catálogo (core + módulos do ramo).
 *
 * Ausência de linha significa "nunca provisionado" (o catálogo ganhou um módulo
 * novo depois que o espaço foi criado), e NÃO "desligado". Sem essa distinção,
 * módulos novos ficavam invisíveis para empresas antigas até um backfill manual.
 */
export function activeModuleIds(
  niche: string,
  configured: ReadonlyMap<string, boolean>,
): Set<string> {
  const known = NICHES.some((n) => n.id === niche);
  const byDefault = new Set([
    ...coreModules().map((m) => m.id),
    ...(known ? modulesForNiche(niche as NicheId).map((m) => m.id) : []),
  ]);

  const active = new Set<string>();
  for (const def of MODULES) {
    const row = configured.get(def.id);
    if (row === undefined ? byDefault.has(def.id) : row) active.add(def.id);
  }
  return active;
}

export function nicheLabel(id: NicheOrOther): string {
  if (id === "outro") return "Outro / não identificado";
  return NICHES.find((n) => n.id === id)?.label ?? id;
}

/**
 * Ramos oferecidos a quem se cadastra AGORA.
 *
 * Use esta lista em toda superfície de escolha (onboarding, classificador de
 * IA, troca de ramo nas configurações). `NICHES` continua completa e é o que
 * `nicheLabel`, `modulesForNiche` e `activeModuleIds` consultam — quem já
 * escolheu um ramo hoje indisponível segue operando sem notar diferença.
 */
export function availableNiches(): Niche[] {
  return NICHES.filter((n) => n.available !== false);
}

/** O ramo ainda é oferecido a novos contratos? */
export function isNicheAvailable(id: string): boolean {
  return availableNiches().some((n) => n.id === id);
}
