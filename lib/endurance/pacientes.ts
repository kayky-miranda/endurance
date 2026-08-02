import "server-only";
import { prisma } from "@/lib/db";
import { parsePage, pageMeta, PAGE_SIZE, type PageMeta } from "./pagination";
import { isValidCpf, onlyDigits } from "./patient";
import { isValidEmail } from "./validation";

/**
 * Cadastro de pacientes (nichos de saúde). O paciente é um Customer (a pessoa,
 * com nome/telefone/e-mail/CPF=document) + um PatientProfile 1:1 com a ficha
 * clínica estendida (identificação, endereço, convênio, responsável). Anexos
 * são referências (links). Tudo isolado por organização.
 */

export interface PatientRow {
  id: string; // customerId
  name: string;
  phone: string;
  cpf: string;
  insuranceName: string;
  city: string;
}

export interface PatientAttachmentRow {
  id: string;
  name: string;
  category: string;
  url: string;
  notes: string;
  uploadedByName: string;
  createdAt: string;
}

export interface PatientDetail {
  id: string; // customerId
  name: string;
  phone: string;
  email: string;
  cpf: string;
  rg: string;
  birthDate: string | null;
  sex: string;
  maritalStatus: string;
  profession: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  insuranceName: string;
  insurancePlan: string;
  insuranceCard: string;
  insuranceValidity: string | null;
  responsibleName: string;
  responsiblePhone: string;
  responsibleRelation: string;
  photoUrl: string;
  notes: string;
  attachments: PatientAttachmentRow[];
}

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

export async function listPatients(
  org: string,
  opts: { term?: string; pagina?: string } = {},
): Promise<{ patients: PatientRow[]; total: number; meta: PageMeta }> {
  const page = parsePage(opts.pagina);
  const term = (opts.term ?? "").trim();

  // A busca é feita no PatientProfile, que não é um modelo de exclusão lógica —
  // o filtro global do Prisma só alcança operações de topo, então o
  // `deletedAt: null` do paciente precisa ser explícito aqui. Sem isso, uma
  // ficha excluída voltaria a aparecer na listagem.
  const where = {
    organizationId: org,
    customer: {
      deletedAt: null,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" as const } },
              { phone: { contains: term } },
              { document: { contains: onlyDigits(term) || term } },
            ],
          }
        : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.patientProfile.count({ where }),
    prisma.patientProfile.findMany({
      where,
      orderBy: { customer: { name: "asc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        insuranceName: true,
        city: true,
        customer: { select: { id: true, name: true, phone: true, document: true } },
      },
    }),
  ]);

  return {
    patients: rows.map((r) => ({
      id: r.customer.id,
      name: r.customer.name,
      phone: r.customer.phone,
      cpf: r.customer.document,
      insuranceName: r.insuranceName,
      city: r.city,
    })),
    total,
    meta: pageMeta(page, total),
  };
}

export async function getPatient(
  org: string,
  customerId: string,
): Promise<PatientDetail | null> {
  const [profile, customer, attachments] = await Promise.all([
    prisma.patientProfile.findFirst({ where: { organizationId: org, customerId } }),
    prisma.customer.findFirst({
      where: { id: customerId, organizationId: org },
      select: { id: true, name: true, phone: true, email: true, document: true },
    }),
    prisma.patientAttachment.findMany({
      where: { organizationId: org, customerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!customer || !profile) return null;

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    cpf: customer.document,
    rg: profile.rg,
    birthDate: dateInput(profile.birthDate),
    sex: profile.sex,
    maritalStatus: profile.maritalStatus,
    profession: profile.profession,
    cep: profile.cep,
    street: profile.street,
    number: profile.number,
    complement: profile.complement,
    district: profile.district,
    city: profile.city,
    state: profile.state,
    insuranceName: profile.insuranceName,
    insurancePlan: profile.insurancePlan,
    insuranceCard: profile.insuranceCard,
    insuranceValidity: dateInput(profile.insuranceValidity),
    responsibleName: profile.responsibleName,
    responsiblePhone: profile.responsiblePhone,
    responsibleRelation: profile.responsibleRelation,
    photoUrl: profile.photoUrl,
    notes: profile.notes,
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      url: a.url,
      notes: a.notes,
      uploadedByName: a.uploadedByName,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export type PatientResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface PatientInput {
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  birthDate?: string | null;
  sex?: string;
  maritalStatus?: string;
  profession?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  insuranceName?: string;
  insurancePlan?: string;
  insuranceCard?: string;
  insuranceValidity?: string | null;
  responsibleName?: string;
  responsiblePhone?: string;
  responsibleRelation?: string;
  photoUrl?: string;
  notes?: string;
}

function validate(input: PatientInput): string | null {
  if (!input.name || !input.name.trim()) return "Nome do paciente é obrigatório.";
  // CPF é opcional, mas se informado precisa ser válido (dígitos verificadores).
  if (input.cpf && input.cpf.trim() && !isValidCpf(input.cpf))
    return "CPF inválido.";
  if (input.email && input.email.trim() && !isValidEmail(input.email))
    return "E-mail inválido.";
  return null;
}

/**
 * O CPF identifica a pessoa: dois pacientes com o mesmo CPF na mesma clínica são
 * o mesmo paciente cadastrado em duplicidade — o que espalha o histórico clínico
 * em duas fichas. Barramos na origem (`exceptCustomerId` libera a própria ficha
 * na edição). Continua opcional: sem CPF informado, nada a checar.
 */
async function cpfTaken(
  org: string,
  cpf: string,
  exceptCustomerId?: string,
): Promise<boolean> {
  const document = onlyDigits(cpf);
  if (!document) return false;
  const clash = await prisma.customer.findFirst({
    where: {
      organizationId: org,
      document,
      ...(exceptCustomerId ? { id: { not: exceptCustomerId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

function profileData(input: PatientInput) {
  return {
    rg: (input.rg ?? "").trim(),
    birthDate: parseDate(input.birthDate),
    sex: (input.sex ?? "").trim(),
    maritalStatus: (input.maritalStatus ?? "").trim(),
    profession: (input.profession ?? "").trim(),
    cep: (input.cep ?? "").trim(),
    street: (input.street ?? "").trim(),
    number: (input.number ?? "").trim(),
    complement: (input.complement ?? "").trim(),
    district: (input.district ?? "").trim(),
    city: (input.city ?? "").trim(),
    state: (input.state ?? "").trim().toUpperCase().slice(0, 2),
    insuranceName: (input.insuranceName ?? "").trim(),
    insurancePlan: (input.insurancePlan ?? "").trim(),
    insuranceCard: (input.insuranceCard ?? "").trim(),
    insuranceValidity: parseDate(input.insuranceValidity),
    responsibleName: (input.responsibleName ?? "").trim(),
    responsiblePhone: (input.responsiblePhone ?? "").trim(),
    responsibleRelation: (input.responsibleRelation ?? "").trim(),
    photoUrl: (input.photoUrl ?? "").trim(),
    notes: (input.notes ?? "").trim(),
  };
}

const customerData = (input: PatientInput) => ({
  name: input.name.trim(),
  phone: (input.phone ?? "").trim(),
  email: (input.email ?? "").trim(),
  document: input.cpf ? onlyDigits(input.cpf) : "",
});

export async function createPatient(
  org: string,
  input: PatientInput,
): Promise<PatientResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  if (input.cpf && (await cpfTaken(org, input.cpf)))
    return { ok: false, error: "Já existe um paciente com este CPF." };

  const id = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { organizationId: org, ...customerData(input) },
      select: { id: true },
    });
    await tx.patientProfile.create({
      data: { organizationId: org, customerId: customer.id, ...profileData(input) },
    });
    return customer.id;
  });
  return { ok: true, id };
}

export async function updatePatient(
  org: string,
  customerId: string,
  input: PatientInput,
): Promise<PatientResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  if (input.cpf && (await cpfTaken(org, input.cpf, customerId)))
    return { ok: false, error: "Já existe um paciente com este CPF." };

  const profile = await prisma.patientProfile.findFirst({
    where: { organizationId: org, customerId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Paciente não encontrado." };

  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: customerData(input) }),
    prisma.patientProfile.update({ where: { id: profile.id }, data: profileData(input) }),
  ]);
  return { ok: true, id: customerId };
}

/**
 * Exclusão LÓGICA do paciente (marca `deletedAt` no Customer). Nunca apagamos de
 * verdade: consultas, prontuário e lançamentos financeiros apontam para esta
 * pessoa e o histórico clínico precisa continuar íntegro e auditável. A ficha
 * some das listagens e da busca; o passado permanece.
 */
export async function deletePatient(
  org: string,
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Paciente não encontrado." };

  await prisma.customer.update({
    where: { id: customerId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

// ---- Anexos (referências/links) ----

export async function addAttachment(
  org: string,
  actor: { id: string; name: string },
  input: { customerId: string; name: string; category?: string; url: string; notes?: string },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!input.name?.trim()) return { ok: false, error: "Dê um nome ao anexo." };
  if (!input.url?.trim()) return { ok: false, error: "Informe o link do anexo." };
  const patient = await prisma.patientProfile.findFirst({
    where: { organizationId: org, customerId: input.customerId },
    select: { id: true },
  });
  if (!patient) return { ok: false, error: "Paciente não encontrado." };

  const created = await prisma.patientAttachment.create({
    data: {
      organizationId: org,
      customerId: input.customerId,
      name: input.name.trim(),
      category: (input.category ?? "documento").trim(),
      url: input.url.trim(),
      notes: (input.notes ?? "").trim(),
      uploadedById: actor.id,
      uploadedByName: actor.name,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function deleteAttachment(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.patientAttachment.findFirst({
    where: { id, organizationId: org },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Anexo não encontrado." };
  await prisma.patientAttachment.delete({ where: { id } });
  return { ok: true };
}
