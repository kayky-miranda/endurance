import "server-only";
import { prisma } from "@/lib/db";
import { money } from "./money";
import { onlyDigits, isValidCnpj } from "./cnpj";
import { PAGE_SIZE, clampPage, pageMeta, type PageMeta } from "./pagination";

// ---------------------------------------------------------------------------
// Serviço de Fornecedores (cadastro completo). Todas as funções são escopadas
// por organizationId (multi-tenant). A camada de actions aplica o RBAC.
// ---------------------------------------------------------------------------

export interface SupplierContactInput {
  name: string;
  role?: string;
  phone?: string;
  mobile?: string;
  email?: string;
}

export interface SupplierInput {
  name: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  ie?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  paymentTermDays?: number;
  leadTimeDays?: number;
  creditLimit?: number;
  rating?: number;
  status?: string;
  note?: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  paymentTermDays: number;
  leadTimeDays: number;
  rating: number;
  status: string;
  orders: number;
  products: number;
}

export interface SupplierKpis {
  total: number;
  ativos: number;
  inativos: number;
  avgLeadTime: number;
}

export interface SupplierContactRow extends SupplierContactInput {
  id: string;
}

export interface SupplierDetail extends SupplierInput {
  id: string;
  contacts: SupplierContactRow[];
  orders: number;
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0));
const round2 = (n: number) => Math.round(n * 100) / 100;
const STATUSES = new Set(["ativo", "inativo"]);

/** Valida e normaliza a entrada de um fornecedor. Erro legível ao usuário. */
function normalizeInput(
  input: SupplierInput,
): { ok: true; data: SupplierInput } | { ok: false; error: string } {
  const name =
    str(input.name, 120) ||
    str(input.nomeFantasia, 120) ||
    str(input.razaoSocial, 120);
  if (!name) return { ok: false, error: "Informe o nome do fornecedor." };

  const cnpjDigits = onlyDigits(input.cnpj ?? "");
  if (cnpjDigits && !isValidCnpj(cnpjDigits))
    return { ok: false, error: "CNPJ inválido. Confira os dígitos." };

  const email = str(input.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "E-mail inválido." };

  const rating = Math.min(5, Math.max(0, Number(input.rating) || 0));
  const status = STATUSES.has(String(input.status)) ? String(input.status) : "ativo";

  return {
    ok: true,
    data: {
      name,
      razaoSocial: str(input.razaoSocial, 160),
      nomeFantasia: str(input.nomeFantasia, 160),
      cnpj: cnpjDigits,
      ie: str(input.ie, 30),
      address: str(input.address, 200),
      city: str(input.city, 80),
      state: str(input.state, 2).toUpperCase(),
      zip: onlyDigits(input.zip ?? "").slice(0, 8),
      country: str(input.country, 60) || "Brasil",
      phone: str(input.phone, 30),
      email,
      paymentTermDays: int(input.paymentTermDays),
      leadTimeDays: int(input.leadTimeDays),
      creditLimit: round2(Number(input.creditLimit) || 0),
      rating,
      status,
      note: str(input.note, 500),
    },
  };
}

export interface SupplierListResult {
  rows: SupplierRow[];
  meta: PageMeta;
  kpis: SupplierKpis;
}

/** Lista paginada com busca (nome/fantasia/razão/CNPJ) e filtro de status. */
export async function listSuppliers(
  org: string,
  opts: { q?: string; status?: string; page?: number } = {},
): Promise<SupplierListResult> {
  const q = (opts.q ?? "").trim();
  const status = STATUSES.has(String(opts.status)) ? String(opts.status) : "";

  const where = {
    organizationId: org,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { nomeFantasia: { contains: q, mode: "insensitive" as const } },
            { razaoSocial: { contains: q, mode: "insensitive" as const } },
            { cnpj: { contains: onlyDigits(q) || q } },
          ],
        }
      : {}),
  };

  const total = await prisma.supplier.count({ where });
  const page = clampPage(opts.page, total);

  const [list, kpiRows] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { orders: true, productLinks: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { organizationId: org },
      select: { status: true, leadTimeDays: true },
    }),
  ]);

  const ativos = kpiRows.filter((s) => s.status === "ativo").length;
  const leadTimes = kpiRows.filter((s) => s.leadTimeDays > 0);
  const avgLeadTime =
    leadTimes.length > 0
      ? Math.round(
          leadTimes.reduce((a, s) => a + s.leadTimeDays, 0) / leadTimes.length,
        )
      : 0;

  return {
    rows: list.map((s) => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj,
      city: s.city,
      state: s.state,
      phone: s.phone,
      email: s.email,
      paymentTermDays: s.paymentTermDays,
      leadTimeDays: s.leadTimeDays,
      rating: s.rating,
      status: s.status,
      orders: s._count.orders,
      products: s._count.productLinks,
    })),
    meta: pageMeta(page, total),
    kpis: {
      total: kpiRows.length,
      ativos,
      inativos: kpiRows.length - ativos,
      avgLeadTime,
    },
  };
}

/** Detalhe completo (com contatos) para edição. null se cross-org/inexistente. */
export async function getSupplierDetail(
  org: string,
  id: string,
): Promise<SupplierDetail | null> {
  const s = await prisma.supplier.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      _count: { select: { orders: true } },
    },
  });
  if (!s || s.organizationId !== org) return null;
  return {
    id: s.id,
    name: s.name,
    razaoSocial: s.razaoSocial,
    nomeFantasia: s.nomeFantasia,
    cnpj: s.cnpj,
    ie: s.ie,
    address: s.address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    country: s.country,
    phone: s.phone,
    email: s.email,
    paymentTermDays: s.paymentTermDays,
    leadTimeDays: s.leadTimeDays,
    creditLimit: money(s.creditLimit),
    rating: s.rating,
    status: s.status,
    note: s.note,
    orders: s._count.orders,
    contacts: s.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: c.phone,
      mobile: c.mobile,
      email: c.email,
    })),
  };
}

export async function createSupplier(
  org: string,
  input: SupplierInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const norm = normalizeInput(input);
  if (!norm.ok) return norm;
  const created = await prisma.supplier.create({
    data: { organizationId: org, ...norm.data },
  });
  return { ok: true, id: created.id };
}

export async function updateSupplier(
  org: string,
  id: string,
  input: SupplierInput,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== org)
    return { ok: false, error: "Fornecedor não encontrado." };
  const norm = normalizeInput(input);
  if (!norm.ok) return norm;
  await prisma.supplier.update({ where: { id }, data: norm.data });
  return { ok: true };
}

/**
 * Exclui um fornecedor. Bloqueia se houver pedidos vinculados (a FK é cascade —
 * apagaria o histórico de compras); nesse caso oriente inativar.
 */
export async function deleteSupplier(
  org: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!s || s.organizationId !== org)
    return { ok: false, error: "Fornecedor não encontrado." };
  if (s._count.orders > 0)
    return {
      ok: false,
      error:
        "Fornecedor com pedidos no histórico. Inative-o em vez de excluir.",
    };
  await prisma.supplier.delete({ where: { id } });
  return { ok: true };
}

export async function addSupplierContact(
  org: string,
  supplierId: string,
  contact: SupplierContactInput,
): Promise<{ ok: boolean; error?: string }> {
  const s = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!s || s.organizationId !== org)
    return { ok: false, error: "Fornecedor não encontrado." };
  const name = str(contact.name, 120);
  if (!name) return { ok: false, error: "Informe o nome do contato." };
  await prisma.supplierContact.create({
    data: {
      supplierId,
      name,
      role: str(contact.role, 80),
      phone: str(contact.phone, 30),
      mobile: str(contact.mobile, 30),
      email: str(contact.email, 120),
    },
  });
  return { ok: true };
}

export async function removeSupplierContact(
  org: string,
  contactId: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await prisma.supplierContact.findUnique({
    where: { id: contactId },
    include: { supplier: { select: { organizationId: true } } },
  });
  if (!c || c.supplier.organizationId !== org)
    return { ok: false, error: "Contato não encontrado." };
  await prisma.supplierContact.delete({ where: { id: contactId } });
  return { ok: true };
}

/** Histórico de alterações do fornecedor (trilha de auditoria). */
export async function getSupplierHistory(
  org: string,
  supplierId: string,
): Promise<{ action: string; detail: string; actor: string; at: string }[]> {
  const logs = await prisma.activityLog.findMany({
    where: { organizationId: org, targetId: supplierId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return logs.map((l) => ({
    action: l.action,
    detail: l.detail,
    actor: l.actorName,
    at: l.createdAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

/** Todos os fornecedores (sem paginação) para exportação CSV/Excel. */
export async function allSuppliersForExport(org: string) {
  return prisma.supplier.findMany({
    where: { organizationId: org },
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true, productLinks: true } } },
  });
}
