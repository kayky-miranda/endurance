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
  | "fiscal.manage"
  | "pdv.sell"
  | "customers.manage"
  | "suppliers.manage"
  | "finance.reports"
  | "reports.export"
  | "team.manage"
  | "integrations.config"
  | "subscription.manage"
  | "settings.general";

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
    id: "suppliers.manage",
    label: "Gerenciar Fornecedores",
    description: "Fornecedores e pedidos de compra.",
    group: "Catálogo & Estoque",
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
      "dashboard.view",
      "pdv.sell",
      "customers.manage",
      "products.manage",
      "stock.manage",
      "suppliers.manage",
      "fiscal.manage",
      "finance.reports",
      "reports.export",
      "team.manage",
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Financeiro, fiscal e exportação de relatórios.",
    baseRole: "MEMBER",
    permissions: [
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
      "suppliers.manage",
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
// Mapa módulo → permissão exigida para navegar. Módulos ausentes do mapa são
// liberados a quem já tem acesso ao módulo pelo papel. Ponto de extensão para
// novos módulos: basta adicionar a linha aqui.
// ---------------------------------------------------------------------------
export const MODULE_PERMISSION: Record<string, PermissionId> = {
  relatorios: "finance.reports",
  financeiro: "finance.reports",
  produtos: "products.manage",
  precificacao: "products.manage",
  estoque: "stock.manage",
  caixa: "pdv.sell",
  pdv: "pdv.sell",
  crm: "customers.manage",
  fornecedores: "suppliers.manage",
  nfce: "fiscal.manage",
  nfe: "fiscal.manage",
  acesso: "team.manage",
  importacao: "settings.general",
};

export function modulePermission(moduleId: string): PermissionId | null {
  return MODULE_PERMISSION[moduleId] ?? null;
}
