"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type R = { ok: true } | { ok: false; error: string };

export interface UpdateCustomerInput {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
}

/** Edita os dados cadastrais de um cliente do espaço (módulo CRM). */
export async function updateCustomerAction(
  input: UpdateCustomerInput,
): Promise<R> {
  const gate = await requirePermission("customers.manage");
  if (!gate.ok) return gate;
  const s = gate.session;

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do cliente." };
  const email = (input.email ?? "").trim();
  if (email && !EMAIL_RE.test(email))
    return { ok: false, error: "E-mail inválido." };

  const target = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!target || target.organizationId !== s.org)
    return { ok: false, error: "Cliente não encontrado." };

  await prisma.customer.update({
    where: { id: target.id },
    data: {
      name: name.slice(0, 80),
      phone: (input.phone ?? "").trim().slice(0, 20),
      email: email.slice(0, 120),
      document: (input.document ?? "").trim().slice(0, 20),
    },
  });
  revalidatePath(`/espaco/${s.slug}/m/crm`);
  return { ok: true };
}
