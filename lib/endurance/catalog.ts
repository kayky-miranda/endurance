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
  | "nutricionista";

/** Inclui "outro" para quando a descrição não casa com nenhum nicho do MVP. */
export type NicheOrOther = NicheId | "outro";

export interface Niche {
  id: NicheId;
  label: string;
  /** Palavras-chave usadas pelo classificador offline (sem acento, minúsculas). */
  keywords: string[];
  /** Frase de exemplo mostrada na interface como atalho. */
  example: string;
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
    description: "Cadastro de fornecedores e pedidos de compra.",
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
    id: "prontuario",
    label: "Prontuário clínico",
    description: "Histórico clínico e anotações do paciente.",
    scope: ["nutricionista"],
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
    scope: ["nutricionista"],
  },
  {
    id: "evolucao",
    label: "Evolução do paciente",
    description: "Acompanhamento de peso e metas ao longo do tempo.",
    scope: ["nutricionista"],
  },
  {
    id: "anamnese",
    label: "Anamnese digital",
    description: "Questionário inicial preenchido pelo paciente.",
    scope: ["nutricionista"],
  },
  {
    id: "confirmacao_auto",
    label: "Confirmação automática",
    description: "Confirmação de consulta por mensagem.",
    scope: ["nutricionista"],
  },
  {
    id: "recibo",
    label: "Emissão de recibo",
    description: "Recibo de atendimento para o paciente.",
    scope: ["nutricionista"],
  },
];

const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function moduleById(id: string): ModuleDef | undefined {
  return MODULE_BY_ID.get(id);
}

// ---- RBAC: acesso aos módulos por papel ----
// Papéis: MEMBER (operação) < ADMIN (gestão) < OWNER (dono).
export type AccessRole = "OWNER" | "ADMIN" | "MEMBER";
const ROLE_RANK: Record<AccessRole, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

// Módulos sensíveis (financeiro/gestão/fiscal) ficam restritos a ADMIN/OWNER.
// Os demais (PDV, caixa, produtos, estoque, CRM…) ficam liberados ao MEMBER.
const ADMIN_MODULES = new Set<string>([
  "financeiro",
  "relatorios",
  "fornecedores",
  "precificacao",
  "nfce",
  "nfe",
  "acesso",
  "notificacoes",
  "comissoes",
  "mensalidades",
  "planos",
  "importacao",
]);

export function moduleMinRole(moduleId: string): AccessRole {
  return ADMIN_MODULES.has(moduleId) ? "ADMIN" : "MEMBER";
}

export function canAccessModule(role: AccessRole, moduleId: string): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[moduleMinRole(moduleId)];
}

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

export function nicheLabel(id: NicheOrOther): string {
  if (id === "outro") return "Outro / não identificado";
  return NICHES.find((n) => n.id === id)?.label ?? id;
}
