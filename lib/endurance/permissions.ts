/**
 * Catálogo de PERMISSÕES e PERFIS (RBAC) do ENDURANCE.
 *
 * Fonte da verdade única do controle de acesso por perfil, no mesmo espírito do
 * `catalog.ts` (módulos): a UI, os server actions e o gating de navegação leem
 * daqui. Adicionar uma permissão nova = uma linha em PERMISSIONS; ligá-la a um
 * módulo = uma linha em MODULE_PERMISSION. Nada na arquitetura precisa mudar —
 * é escalável para novos módulos e permissões do ERP.
 */

export type PermissionId =
  | "dashboard.view"
  | "products.manage"
  | "stock.manage"
  | "count.manage"
  | "count.approve"
  | "fiscal.manage"
  | "pdv.sell"
  | "customers.manage"
  | "suppliers.manage"
  | "purchasing.request"
  | "purchasing.approve"
  | "purchasing.manage"
  | "finance.reports"
  | "reports.export"
  | "sales.view_all"
  | "team.manage"
  | "integrations.config"
  | "subscription.manage"
  | "settings.general"
  | "marketing.manage";

export interface PermissionDef {
  id: PermissionId;
  label: string;
  description: string;
  /** Grupo para organizar a UI em seções. */
  group: string;
}

/** Catálogo de permissões. A ordem define a ordem de exibição na interface. */
export const PERMISSIONS: PermissionDef[] = [
  // ---- Operação ----
  {
    id: "dashboard.view",
    label: "Visualizar Dashboard",
    description: "Acessar a visão geral e os indicadores do negócio.",
    group: "Operação",
  },
  {
    id: "pdv.sell",
    label: "Realizar vendas no PDV",
    description: "Operar a frente de caixa e o fechamento de caixa.",
    group: "Operação",
  },
  {
    id: "customers.manage",
    label: "Gerenciar Clientes",
    description: "Cadastrar e editar clientes (CRM).",
    group: "Operação",
  },
  // ---- Catálogo & Estoque ----
  {
    id: "products.manage",
    label: "Gerenciar Produtos",
    description: "Cadastro de produtos, preços e precificação.",
    group: "Catálogo & Estoque",
  },
  {
    id: "stock.manage",
    label: "Gerenciar Estoque",
    description: "Entradas, saídas e ajustes de estoque.",
    group: "Catálogo & Estoque",
  },
  {
    id: "count.manage",
    label: "Conferência de Estoque",
    description: "Criar conferências, contar itens e registrar divergências.",
    group: "Catálogo & Estoque",
  },
  {
    id: "count.approve",
    label: "Aprovar Conferências",
    description: "Aprovar divergências e efetivar o ajuste no estoque.",
    group: "Catálogo & Estoque",
  },
  {
    id: "suppliers.manage",
    label: "Gerenciar Fornecedores",
    description: "Cadastro de fornecedores e vínculo com produtos.",
    group: "Catálogo & Estoque",
  },
  // ---- Suprimentos / Compras ----
  {
    id: "purchasing.request",
    label: "Solicitar Compras",
    description: "Criar e acompanhar solicitações de compra de materiais.",
    group: "Suprimentos",
  },
  {
    id: "purchasing.approve",
    label: "Aprovar Compras",
    description: "Aprovar, rejeitar ou solicitar ajustes nas requisições.",
    group: "Suprimentos",
  },
  {
    id: "purchasing.manage",
    label: "Gerenciar Compras",
    description: "Cotações, pedidos de compra e recebimento de materiais.",
    group: "Suprimentos",
  },
  // ---- Fiscal & Financeiro ----
  {
    id: "fiscal.manage",
    label: "Emitir e consultar Notas Fiscais",
    description: "Emissão, consulta e cancelamento de NFC-e / NF-e.",
    group: "Fiscal & Financeiro",
  },
  {
    id: "finance.reports",
    label: "Acessar Relatórios Financeiros",
    description: "Contas a pagar/receber, fluxo de caixa e relatórios.",
    group: "Fiscal & Financeiro",
  },
  {
    id: "reports.export",
    label: "Exportar relatórios (PDF, Excel e XML)",
    description: "Baixar relatórios e documentos em PDF, Excel e XML.",
    group: "Fiscal & Financeiro",
  },
  {
    id: "sales.view_all",
    label: "Ver vendas de toda a equipe",
    description:
      "Sem esta permissão, o painel e os relatórios mostram apenas as próprias vendas do usuário.",
    group: "Fiscal & Financeiro",
  },
  // ---- Administração ----
  {
    id: "team.manage",
    label: "Gerenciar Funcionários",
    description: "Criar, editar, bloquear e definir permissões de usuários.",
    group: "Administração",
  },
  {
    id: "integrations.config",
    label: "Configurar Integrações",
    description: "Chaves de API, IA e integrações externas.",
    group: "Administração",
  },
  {
    id: "subscription.manage",
    label: "Gerenciar Assinatura e Plano",
    description: "Plano contratado, cobrança e faturas.",
    group: "Administração",
  },
  {
    id: "settings.general",
    label: "Configurações Gerais do Sistema",
    description: "Dados da empresa e preferências do espaço.",
    group: "Administração",
  },
  // ---- Marketing ----
  {
    id: "marketing.manage",
    label: "Marketing com IA",
    description: "Criar e publicar carrosséis para Instagram com IA.",
    group: "Operação",
  },
];

/** Grupos na ordem de exibição (derivados do catálogo, preservando a ordem). */
export const PERMISSION_GROUPS: string[] = PERMISSIONS.reduce<string[]>(
  (acc, p) => (acc.includes(p.group) ? acc : [...acc, p.group]),
  [],
);

const PERMISSION_BY_ID = new Map(PERMISSIONS.map((p) => [p.id, p]));

export function permissionLabel(id: string): string {
  return PERMISSION_BY_ID.get(id as PermissionId)?.label ?? id;
}

export function allPermissionIds(): PermissionId[] {
  return PERMISSIONS.map((p) => p.id);
}

/** Mantém só ids de permissão que existem no catálogo (sanitização de entrada). */
export function sanitizePermissions(ids: string[]): PermissionId[] {
  const valid = new Set<string>(allPermissionIds());
  return Array.from(new Set(ids.filter((id) => valid.has(id)))) as PermissionId[];
}

// ---------------------------------------------------------------------------
// PERFIS pré-configurados. Cada um agrupa um conjunto de permissões e define o
// papel-base (para o gating legado por papel). "Administrador" recebe tudo.
// ---------------------------------------------------------------------------
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface ProfileDef {
  id: string;
  label: string;
  description: string;
  /** Papel-base mapeado para o RBAC legado (OWNER/ADMIN/MEMBER). */
  baseRole: Exclude<Role, "OWNER">;
  permissions: PermissionId[];
}

export const PROFILES: ProfileDef[] = [
  {
    id: "administrador",
    label: "Administrador",
    description: "Acesso total ao espaço, incluindo gestão de usuários.",
    baseRole: "ADMIN",
    permissions: allPermissionIds(),
  },
  {
    id: "gerente",
    label: "Gerente",
    description: "Gestão operacional ampla e equipe, sem cobrança/integrações.",
    baseRole: "ADMIN",
    permissions: [
      "sales.view_all",
      "dashboard.view",
      "pdv.sell",
      "customers.manage",
      "products.manage",
      "stock.manage",
      "count.manage",
      "count.approve",
      "suppliers.manage",
      "purchasing.request",
      "purchasing.approve",
      "purchasing.manage",
      "fiscal.manage",
      "finance.reports",
      "reports.export",
      "team.manage",
      "marketing.manage",
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Financeiro, fiscal e exportação de relatórios.",
    baseRole: "MEMBER",
    permissions: [
      "sales.view_all",
      "dashboard.view",
      "finance.reports",
      "reports.export",
      "fiscal.manage",
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Produtos, estoque e fornecedores.",
    baseRole: "MEMBER",
    permissions: [
      "dashboard.view",
      "products.manage",
      "stock.manage",
      "count.manage",
      "count.approve",
      "suppliers.manage",
      "purchasing.request",
      "purchasing.manage",
    ],
  },
  {
    id: "caixa",
    label: "Caixa",
    description: "Frente de caixa e clientes (sem o painel de faturamento).",
    baseRole: "MEMBER",
    permissions: ["pdv.sell", "customers.manage"],
  },
  {
    id: "vendedor",
    label: "Vendedor",
    description: "Vendas no PDV e atendimento (sem o painel de faturamento).",
    baseRole: "MEMBER",
    permissions: ["pdv.sell", "customers.manage"],
  },
  {
    id: "operador",
    label: "Operador",
    description: "Acesso básico apenas ao painel.",
    baseRole: "MEMBER",
    permissions: ["dashboard.view"],
  },
];

const PROFILE_BY_ID = new Map(PROFILES.map((p) => [p.id, p]));

export function profileById(id: string): ProfileDef | undefined {
  return PROFILE_BY_ID.get(id);
}

export function profileLabel(id: string): string {
  return PROFILE_BY_ID.get(id)?.label ?? "Personalizado";
}

export function permissionsForProfile(id: string): PermissionId[] {
  return profileById(id)?.permissions ?? [];
}

// ---------------------------------------------------------------------------
// Verificação efetiva de permissão. OWNER e ADMIN têm acesso total (mantém o
// comportamento atual e evita travar donos/admins). Os demais são gated pela
// lista explícita de permissões.
// ---------------------------------------------------------------------------
export function isFullAccess(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function hasPermission(
  role: string,
  permissions: string[] | undefined,
  permId: PermissionId,
): boolean {
  if (isFullAccess(role)) return true;
  return Boolean(permissions?.includes(permId));
}

/** Permissões efetivas de um usuário (tudo para OWNER/ADMIN). */
export function effectivePermissions(
  role: string,
  permissions: string[] | undefined,
): PermissionId[] {
  if (isFullAccess(role)) return allPermissionIds();
  return sanitizePermissions(permissions ?? []);
}

// ---------------------------------------------------------------------------
// Mapa módulo → permissão exigida para navegar. É a fonte da verdade única do
// gating de módulos (substituiu o antigo ADMIN_MODULES por papel). Módulos
// ausentes do mapa são liberados a qualquer usuário autenticado do espaço.
// Ponto de extensão para novos módulos: basta adicionar a linha aqui.
// ---------------------------------------------------------------------------
export const MODULE_PERMISSION: Record<string, PermissionId> = {
  relatorios: "finance.reports",
  financeiro: "finance.reports",
  produtos: "products.manage",
  precificacao: "products.manage",
  codigo_barras: "products.manage",
  estoque: "stock.manage",
  movimentacoes: "stock.manage",
  transferencias: "stock.manage",
  conferencia: "count.manage",
  caixa: "pdv.sell",
  pdv: "pdv.sell",
  crm: "customers.manage",
  fornecedores: "suppliers.manage",
  // Suprimentos / Compras
  compras: "purchasing.manage",
  solicitacoes: "purchasing.request",
  aprovacoes: "purchasing.approve",
  cotacoes: "purchasing.manage",
  pedidos_compra: "purchasing.manage",
  recebimento: "purchasing.manage",
  nfce: "fiscal.manage",
  nfe: "fiscal.manage",
  acesso: "team.manage",
  notificacoes: "integrations.config",
  importacao: "settings.general",
  marketing: "marketing.manage",
  // Nichos academia/salão: cobrança e comissões são financeiro; planos é
  // catálogo de preços (mesma permissão da precificação).
  mensalidades: "finance.reports",
  comissoes: "finance.reports",
  planos: "products.manage",
};

export function modulePermission(moduleId: string): PermissionId | null {
  return MODULE_PERMISSION[moduleId] ?? null;
}

/**
 * Acesso a um módulo = ter a permissão que ele exige (módulos sem permissão
 * mapeada são livres). Verificação única usada pela navegação e pelas páginas.
 */
export function canAccessModule(
  role: string,
  permissions: string[] | undefined,
  moduleId: string,
): boolean {
  const required = modulePermission(moduleId);
  return required ? hasPermission(role, permissions, required) : true;
}
