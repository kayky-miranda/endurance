"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/endurance/activity-log";
import { isValidCnpj } from "@/lib/endurance/cnpj";
import { isValidCpf } from "@/lib/endurance/patient";

/**
 * Gravação POR ETAPA do cadastro do estabelecimento.
 *
 * Cada etapa tem seu próprio esquema: validar o cadastro inteiro a cada salvar
 * recusaria a etapa 2 por causa de um campo da etapa 5 que o cliente ainda nem
 * viu. A checagem do conjunto é feita pela prontidão fiscal, na revisão.
 *
 * Os campos aceitam VAZIO de propósito — o cadastro é preenchido aos poucos,
 * muitas vezes com dado que depende do contador. O que impede de emitir é
 * apontado no checklist, não numa recusa de gravação.
 */

const digits = (v: string) => v.replace(/\D/g, "");
const opt = (max: number) => z.string().trim().max(max).default("");

/** CNPJ/CPF só são validados quando preenchidos: vazio é etapa incompleta. */
const cnpjField = opt(18).refine((v) => !v || isValidCnpj(v), "CNPJ inválido.");
const cpfField = opt(14).refine((v) => !v || isValidCpf(v), "CPF inválido.");

const EmpresaSchema = z.object({
  cnpj: cnpjField,
  razaoSocial: opt(160),
  nomeFantasia: opt(160),
  ie: opt(20),
  inscricaoMunicipal: opt(20),
  cnaePrincipal: opt(10),
  cnaeSecundarios: opt(400),
  naturezaJuridica: opt(120),
  porte: opt(60),
  dataAbertura: opt(10),
  situacaoCadastral: opt(40),
  email: opt(160).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "E-mail inválido.",
  ),
  telefone: opt(20),
  site: opt(160),
  respNome: opt(120),
  respCpf: cpfField,
  respEmail: opt(160),
  respTelefone: opt(20),
  respCargo: opt(60),
});

const EnderecoSchema = z.object({
  cep: opt(9).refine((v) => !v || digits(v).length === 8, "CEP deve ter 8 dígitos."),
  logradouro: opt(160),
  numeroEnd: opt(20),
  complemento: opt(80),
  bairro: opt(80),
  municipio: opt(120),
  uf: opt(2),
  cMun: opt(7).refine(
    (v) => !v || digits(v).length === 7,
    "O código IBGE tem 7 dígitos.",
  ),
  pais: opt(60),
});

const FiscalSchema = z.object({
  crt: z.enum(["1", "2", "3"]).default("1"),
  indicadorIe: z.enum(["1", "2", "9"]).default("1"),
  cscId: opt(10),
  csc: opt(80),
  defaultNcm: opt(8).refine(
    (v) => !v || digits(v).length === 8,
    "O NCM tem 8 dígitos.",
  ),
});

const EmissaoSchema = z.object({
  serie: z.coerce.number().int().min(1).max(999).default(1),
  proxNumero: z.coerce.number().int().min(1).default(1),
  ambiente: z.enum(["1", "2"]).default("2"),
  naturezaOperacao: opt(120),
});

const SCHEMAS = {
  empresa: EmpresaSchema,
  endereco: EnderecoSchema,
  fiscal: FiscalSchema,
  emissao: EmissaoSchema,
} as const;

export type EditableStep = keyof typeof SCHEMAS;

type R = { ok: boolean; error?: string; field?: string };

export async function saveEstablishmentStepAction(
  step: EditableStep,
  input: Record<string, unknown>,
): Promise<R> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const schema = SCHEMAS[step];
  if (!schema) return { ok: false, error: "Etapa desconhecida." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Devolve o CAMPO junto: a tela destaca onde está o problema em vez de
    // mostrar um erro solto no topo do formulário.
    return {
      ok: false,
      error: issue?.message ?? "Dados inválidos.",
      field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
    };
  }

  const data = { ...parsed.data } as Record<string, unknown>;

  // Normalizações que valem para o documento inteiro, não por campo.
  if (typeof data.cnpj === "string") data.cnpj = digits(data.cnpj);
  if (typeof data.respCpf === "string") data.respCpf = digits(data.respCpf);
  if (typeof data.cep === "string") data.cep = digits(data.cep);
  if (typeof data.cMun === "string") data.cMun = digits(data.cMun);
  if (typeof data.defaultNcm === "string") data.defaultNcm = digits(data.defaultNcm);
  if (typeof data.uf === "string") data.uf = data.uf.toUpperCase();
  if (step === "empresa") {
    const iso = String(data.dataAbertura ?? "");
    data.dataAbertura = iso ? new Date(`${iso}T12:00:00Z`) : null;
  }

  await prisma.fiscalConfig.upsert({
    where: { organizationId: s.org },
    create: { organizationId: s.org, ...data },
    update: data,
  });

  revalidatePath(`/espaco/${s.slug}/estabelecimento`);
  revalidatePath(`/espaco/${s.slug}/m/nfce`);
  await logActivity(
    s,
    "estabelecimento.update",
    `Atualizou o cadastro do estabelecimento (etapa: ${step})`,
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contatos por área
// ---------------------------------------------------------------------------

const ContactSchema = z.object({
  area: z.enum(["financeiro", "fiscal", "administrativo", "comercial", "outro"]),
  name: z.string().trim().min(2, "Informe o nome do contato.").max(120),
  email: opt(160),
  phone: opt(20),
  role: opt(60),
});

export async function saveCompanyContactAction(
  input: Record<string, unknown>,
): Promise<R> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await prisma.companyContact.create({
    data: { organizationId: s.org, ...parsed.data },
  });
  revalidatePath(`/espaco/${s.slug}/estabelecimento`);
  await logActivity(s, "estabelecimento.contact_add", `Adicionou contato de ${parsed.data.area}`);
  return { ok: true };
}

export async function removeCompanyContactAction(id: string): Promise<R> {
  const gate = await requirePermission("fiscal.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  // deleteMany com a organização no filtro: impede apagar contato de outra
  // empresa passando um id adivinhado.
  const res = await prisma.companyContact.deleteMany({
    where: { id, organizationId: s.org },
  });
  if (res.count === 0) return { ok: false, error: "Contato não encontrado." };

  revalidatePath(`/espaco/${s.slug}/estabelecimento`);
  await logActivity(s, "estabelecimento.contact_remove", "Removeu um contato da empresa");
  return { ok: true };
}
