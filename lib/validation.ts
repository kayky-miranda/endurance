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

// -- Helper -----------------------------------------------------------------

/** Retorna a primeira mensagem de erro num formato curto e amigável. */
export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Dados inválidos.";
}
