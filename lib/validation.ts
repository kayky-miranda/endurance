import "server-only";
import { z } from "zod";

/**
 * Schemas Zod compartilhados — fonte única de validação para o que entra
 * via formulário/server action. Mantém mensagens em PT-BR e cobre os pontos
 * antes feitos manualmente (length, formato, blacklist de chars).
 *
 * USO:
 *   const r = SignupSchema.safeParse(input);
 *   if (!r.success) return { ok: false, error: firstError(r.error) };
 *   // r.data já está tipado e sanitizado.
 */

// -- Primitivos reutilizáveis ----------------------------------------------

export const emailField = z
  .string({ message: "E-mail é obrigatório." })
  .trim()
  .toLowerCase()
  .min(3, "E-mail muito curto.")
  .max(120, "E-mail muito longo.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido.");

export const strongPasswordField = z
  .string({ message: "Senha é obrigatória." })
  .min(8, "A senha precisa ter ao menos 8 caracteres.")
  .max(128, "Senha muito longa (limite 128 caracteres).")
  .refine((s) => /[a-zA-Z]/.test(s), "A senha precisa ter ao menos uma letra.")
  .refine((s) => /[0-9]/.test(s), "A senha precisa ter ao menos um número.");

export const personNameField = z
  .string({ message: "Nome é obrigatório." })
  .trim()
  .min(1, "Informe o nome.")
  .max(80, "Nome muito longo.");

export const phoneField = z
  .string()
  .trim()
  .max(20)
  .default("");

// -- Compostos: cadastro e equipe ------------------------------------------

export const SignupSchema = z.object({
  name: personNameField,
  niche: z.string().trim().min(1, "Escolha um nicho."),
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  country: z.string().trim().max(60).optional(),
  segment: z.string().trim().max(120).optional(),
  moduleIds: z.array(z.string()).min(1, "Selecione ao menos um módulo."),
  ownerName: personNameField,
  email: emailField,
  password: strongPasswordField,
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const CreateUserSchema = z.object({
  name: personNameField,
  email: emailField,
  password: strongPasswordField,
  phone: phoneField.optional(),
  jobTitle: z.string().trim().max(60).default(""),
  profile: z.string().min(1, "Escolha um perfil."),
  permissions: z.array(z.string()).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const CreateInviteSchema = z.object({
  email: emailField,
  profile: z.string().min(1, "Escolha um perfil."),
  permissions: z.array(z.string()).optional(),
});
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().min(20),
  name: personNameField,
  password: strongPasswordField,
});

// -- Compostos: módulos operacionais (produtos, financeiro, fiscal) --------

/** Produto novo (createProductAction). Numéricos são lenientes: valor inválido vira 0. */
export const ProductSchema = z.object({
  name: z
    .string({ message: "Informe o nome do produto." })
    .trim()
    .min(1, "Informe o nome do produto.")
    .max(120, "Nome do produto muito longo."),
  barcode: z.string().trim().max(64, "Código de barras muito longo.").optional().default(""),
  category: z.string().trim().max(80, "Categoria muito longa.").optional().default(""),
  // NCM fiscal (8 dígitos). Opcional: vazio herda o NCM padrão da empresa na
  // emissão. Se informado, exige exatamente 8 dígitos (padrão SEFAZ).
  ncm: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s === "" || s.length === 8, {
      message: "O NCM deve ter 8 dígitos.",
    }),
  // Unidade comercial (un, cx, kg, l...). Usada na emissão fiscal.
  unit: z
    .string()
    .trim()
    .max(10, "Unidade muito longa.")
    .optional()
    .default("un")
    .transform((s) => (s ? s.toLowerCase() : "un")),
  price: z
    .coerce.number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) && n > 0 ? n : 0)),
  stock: z
    .coerce.number()
    .catch(0)
    .transform((n) => Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0))),
  // Estoque mínimo: dispara o alerta de reposição deste produto. 0 = usa a
  // régua automática (velocidade de venda) em vez de um ponto fixo.
  minStock: z
    .coerce.number()
    .catch(0)
    .transform((n) => Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0)))
    .refine((n) => n <= 1_000_000, "Estoque mínimo acima do limite."),
});
export type ProductInput = z.infer<typeof ProductSchema>;

/** Ajuste manual de estoque (adjustStockAction). delta inteiro, pode ser negativo. */
export const StockAdjustSchema = z.object({
  id: z.string().trim().min(1, "Produto inválido."),
  delta: z
    .coerce.number()
    .catch(0)
    .transform((n) => Math.trunc(Number.isFinite(n) ? n : 0)),
});

/** Venda do PDV (finalizeSaleAction) — caminho do dinheiro, tolerância zero
 * a NaN/fracionário/valores absurdos. As regras de negócio (estoque, troco,
 * PIX) continuam na action; aqui só entra higiene de dados. */
export const FinalizeSaleSchema = z.object({
  token: z.string().trim().min(8, "Token de venda ausente.").max(80),
  customerId: z.string().trim().max(40).nullish(),
  pixChargeId: z.string().trim().max(40).nullish(),
  discount: z
    .coerce.number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0))
    .refine((n) => n <= 9_999_999, "Desconto acima do limite."),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(40),
        qty: z
          .coerce.number()
          .refine((n) => Number.isFinite(n) && n > 0, "Quantidade inválida.")
          .refine((n) => Number.isInteger(n), "Quantidade deve ser inteira.")
          .refine((n) => n <= 100_000, "Quantidade acima do limite."),
      }),
    )
    .min(1, "Carrinho vazio.")
    .max(500, "Carrinho grande demais."),
  payments: z
    .array(
      z.object({
        method: z.enum(["dinheiro", "credito", "debito", "pix"]),
        amount: z
          .coerce.number()
          .refine((n) => Number.isFinite(n) && n > 0, "Valor de pagamento inválido.")
          .refine((n) => n <= 9_999_999, "Pagamento acima do limite.")
          .transform((n) => Math.round(n * 100) / 100),
      }),
    )
    .max(10, "Formas de pagamento demais.")
    .optional()
    .default([]),
});
export type FinalizeSaleInput = z.infer<typeof FinalizeSaleSchema>;

/** Cliente rápido do PDV (createCustomerAction). */
export const CustomerSchema = z.object({
  name: z
    .string({ message: "Informe o nome do cliente." })
    .trim()
    .min(1, "Informe o nome do cliente.")
    .max(80, "Nome muito longo."),
  phone: z.string().trim().max(20, "Telefone muito longo.").optional().default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "E-mail muito longo.")
    .refine(
      (e) => e === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
      "E-mail inválido.",
    )
    .optional()
    .default(""),
  document: z.string().trim().max(20, "Documento muito longo.").optional().default(""),
});
export type CustomerFormInput = z.infer<typeof CustomerSchema>;

/** Lançamento financeiro (createEntryAction). */
export const FinanceEntrySchema = z.object({
  kind: z.enum(["receber", "pagar"]).catch("receber"),
  description: z
    .string({ message: "Informe a descrição." })
    .trim()
    .min(1, "Informe a descrição.")
    .max(120, "Descrição muito longa."),
  category: z
    .string()
    .trim()
    .max(40, "Categoria muito longa.")
    .optional()
    .transform((c) => (c && c.length ? c : "Outros")),
  amount: z
    .coerce.number()
    .catch(0)
    .refine((n) => n > 0, "Informe um valor válido.")
    .transform((n) => Math.round(n * 100) / 100),
  dueDate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (d) => d === "" || !Number.isNaN(new Date(`${d}T12:00:00`).getTime()),
      "Data de vencimento inválida.",
    ),
});
export type FinanceEntryInput = z.infer<typeof FinanceEntrySchema>;

/** Configuração fiscal (saveFiscalConfigAction). Cada campo já sai sanitizado. */
export const FiscalConfigSchema = z.object({
  cnpj: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, "").slice(0, 14))
    .refine((v) => v.length === 14, "Informe um CNPJ válido (14 dígitos)."),
  razaoSocial: z
    .string()
    .trim()
    .max(120, "Razão social muito longa.")
    .optional()
    .default("")
    .refine((v) => v.length > 0, "Informe a razão social."),
  nomeFantasia: z.string().trim().max(120).optional().default(""),
  ie: z.string().trim().max(20).optional().default(""),
  crt: z
    .string()
    .optional()
    .default("1")
    .transform((v) => (v === "3" ? "3" : "1")),
  uf: z
    .string()
    .optional()
    .default("SP")
    .transform((v) => (v || "SP").toUpperCase().slice(0, 2)),
  municipio: z.string().trim().max(80).optional().default(""),
  cMun: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, "").slice(0, 7)),
  serie: z
    .coerce.number()
    .catch(1)
    .transform((n) => Math.max(1, Math.min(999, Math.trunc(Number.isFinite(n) ? n : 1)))),
  ambiente: z
    .string()
    .optional()
    .default("2")
    .transform((v) => (v === "1" ? "1" : "2")),
  cscId: z
    .string()
    .optional()
    .default("000001")
    .transform((v) => v.replace(/\D/g, "").slice(0, 6) || "000001"),
  csc: z.string().trim().max(64).optional().default(""),
  provider: z
    .string()
    .optional()
    .default("")
    .transform((v) => (v === "focusnfe" ? "focusnfe" : "")),
  defaultNcm: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, "").slice(0, 8)),
});
export type FiscalConfigData = z.infer<typeof FiscalConfigSchema>;

// -- Helper -----------------------------------------------------------------

/** Retorna a primeira mensagem de erro num formato curto e amigável. */
export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Dados inválidos.";
}
