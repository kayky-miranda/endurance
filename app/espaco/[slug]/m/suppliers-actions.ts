"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  addSupplierContact,
  removeSupplierContact,
  getSupplierDetail,
  getSupplierHistory,
  type SupplierInput,
  type SupplierContactInput,
  type SupplierDetail,
} from "@/lib/endurance/suppliers";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

function rev(slug: string) {
  revalidatePath(`/espaco/${slug}/m/fornecedores`);
}

export async function createSupplierAction(
  input: SupplierInput,
): Promise<R & { id?: string }> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createSupplier(s.org, input);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "supplier.create",
      `Cadastrou o fornecedor ${String(input.name ?? "").trim().slice(0, 80)}`,
      res.id,
    );
  }
  return res;
}

export async function updateSupplierAction(
  id: string,
  input: SupplierInput,
): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await updateSupplier(s.org, id, input);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "supplier.update",
      `Editou o fornecedor ${String(input.name ?? "").trim().slice(0, 80)}`,
      id,
    );
  }
  return res;
}

export async function deleteSupplierAction(id: string): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await deleteSupplier(s.org, id);
  if (res.ok) {
    rev(s.slug);
    await logActivity(s, "supplier.delete", "Excluiu um fornecedor", id);
  }
  return res;
}

export async function addSupplierContactAction(
  supplierId: string,
  contact: SupplierContactInput,
): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await addSupplierContact(s.org, supplierId, contact);
  if (res.ok) {
    rev(s.slug);
    await logActivity(
      s,
      "supplier.contact.add",
      `Adicionou contato ${String(contact.name ?? "").trim().slice(0, 60)}`,
      supplierId,
    );
  }
  return res;
}

export async function removeSupplierContactAction(
  contactId: string,
): Promise<R> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await removeSupplierContact(s.org, contactId);
  if (res.ok) rev(s.slug);
  return res;
}

/** Carrega o detalhe + histórico para abrir o formulário de edição. */
export async function loadSupplierAction(id: string): Promise<{
  ok: boolean;
  error?: string;
  detail?: SupplierDetail;
  history?: { action: string; detail: string; actor: string; at: string }[];
}> {
  const gate = await requirePermission("suppliers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const detail = await getSupplierDetail(s.org, id);
  if (!detail) return { ok: false, error: "Fornecedor não encontrado." };
  const history = await getSupplierHistory(s.org, id);
  return { ok: true, detail, history };
}
