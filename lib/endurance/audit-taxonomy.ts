/**
 * Taxonomia da trilha de auditoria — PURA (serve cliente e servidor).
 *
 * A trilha já era gravada em ~130 pontos do sistema com a convenção
 * `<dominio>.<verbo>` (`nfce.emit`, `finance.entry_create`, `stock.adjust`).
 * O que faltava era o outro lado: um jeito de LER isso. Sem agrupamento, uma
 * lista com 40 prefixos diferentes é ilegível — e uma trilha ilegível não
 * responde a pergunta que justifica existir ("quem mexeu nisso?").
 *
 * O domínio é derivado do prefixo em vez de enumerado ação por ação: assim um
 * `logActivity` novo entra na tela certa sem ninguém precisar lembrar de
 * cadastrá-lo aqui. Prefixo desconhecido cai em "Outros" — nunca some.
 */

export interface AuditDomain {
  id: string;
  label: string;
  /** Prefixos de `action` que pertencem a este domínio. */
  prefixes: string[];
  /** Toca dado pessoal/clínico — destacado na tela por causa da LGPD. */
  sensitive?: boolean;
}

export const AUDIT_DOMAINS: AuditDomain[] = [
  {
    id: "clinico",
    label: "Clínico",
    prefixes: [
      "patient",
      "prontuario",
      "clinical_note",
      "anamnese",
      "prescription",
      "certificate",
      "exam",
      "metric",
      "meal_plan",
      "assessment",
      "workout",
      "student",
      "analise_clinica",
    ],
    sensitive: true,
  },
  {
    id: "agenda",
    label: "Agenda",
    prefixes: ["appointment", "agenda", "waitlist"],
    sensitive: true,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    prefixes: ["finance", "cash", "commission", "receipt", "pix"],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    prefixes: ["nfce", "nfe", "fiscal"],
  },
  {
    id: "estoque",
    label: "Estoque e produtos",
    prefixes: [
      "stock",
      "stock_count",
      "product",
      "barcode",
      "transfer",
      "supplier",
      "purchase",
      "purchaseorder",
      "requisition",
      "quotation",
      "receiving",
    ],
  },
  {
    id: "acesso",
    label: "Acesso e equipe",
    prefixes: ["user", "invite", "password", "2fa", "professional"],
    sensitive: true,
  },
  {
    id: "conta",
    label: "Conta e configurações",
    prefixes: [
      "subscription",
      "billing",
      "settings",
      "theme",
      "location",
      "apikey",
      "documents",
      "template",
      "modules",
      "import",
    ],
  },
];

const DOMAIN_BY_PREFIX = new Map<string, AuditDomain>();
for (const d of AUDIT_DOMAINS) {
  for (const p of d.prefixes) DOMAIN_BY_PREFIX.set(p, d);
}

export const OTHER_DOMAIN: AuditDomain = {
  id: "outros",
  label: "Outros",
  prefixes: [],
};

/** Prefixo de uma action (`finance.entry_create` → `finance`). */
export function actionPrefix(action: string): string {
  const i = action.indexOf(".");
  return i === -1 ? action : action.slice(0, i);
}

/** Domínio de uma action. Nunca devolve nulo — desconhecido vira "Outros". */
export function domainOf(action: string): AuditDomain {
  return DOMAIN_BY_PREFIX.get(actionPrefix(action)) ?? OTHER_DOMAIN;
}

/** A action toca dado pessoal ou clínico? */
export function isSensitive(action: string): boolean {
  return Boolean(domainOf(action).sensitive);
}

const VERB_LABEL: Record<string, string> = {
  create: "criou",
  update: "atualizou",
  delete: "excluiu",
  remove: "removeu",
  emit: "emitiu",
  cancel: "cancelou",
  adjust: "ajustou",
  approve: "aprovou",
  reject: "recusou",
  block: "bloqueou",
  unblock: "desbloqueou",
  export: "exportou",
  import: "importou",
};

/**
 * Rótulo legível de uma action, para quando o `detail` gravado estiver vazio.
 * O detalhe escrito à mão sempre ganha — aqui é só o último recurso.
 */
export function actionLabel(action: string): string {
  const [prefix, ...rest] = action.split(".");
  const verb = rest.join(".");
  const known = VERB_LABEL[verb];
  return known ? `${known} (${prefix})` : action;
}
