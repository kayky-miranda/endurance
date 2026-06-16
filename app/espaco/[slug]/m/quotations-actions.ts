"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  createQuotation,
  saveSupplierBid,
  chooseWinner,
  type QuotationItemInput,
} from "@/lib/endurance/quotations";
import { logActivity } from "@/lib/endurance/activity-log";

type R = { ok: boolean; error?: string };

export async function createQuotationAction(input: {
  requisitionId?: string | null;
  supplierIds: string[];
  items?: QuotationItemInput[];
  note?: string;
}): Promise<R & { id?: string }> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await createQuotation(s.org, input);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/cotacoes`);
    await logActivity(
      s,
      "quotation.create",
      `Criou cotação com ${(input.supplierIds ?? []).length} fornecedor(es)`,
      res.id,
    );
  }
  return res;
}

export async function saveSupplierBidAction(
  quotationId: string,
  quotationSupplierId: string,
  input: {
    paymentTerm?: string;
    leadTimeDays?: number;
    prices: { quotationItemId: string; unitPrice: number }[];
  },
): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await saveSupplierBid(s.org, quotationSupplierId, input);
  if (res.ok) revalidatePath(`/espaco/${s.slug}/m/cotacoes/${quotationId}`);
  return res;
}

export async function chooseWinnerAction(
  quotationId: string,
  supplierId: string,
): Promise<R> {
  const gate = await requirePermission("purchasing.manage");
  if (!gate.ok) return gate;
  const s = gate.session;
  const res = await chooseWinner(s.org, quotationId, supplierId);
  if (res.ok) {
    revalidatePath(`/espaco/${s.slug}/m/cotacoes/${quotationId}`);
    revalidatePath(`/espaco/${s.slug}/m/cotacoes`);
    revalidatePath(`/espaco/${s.slug}/m/solicitacoes`);
    await logActivity(
      s,
      "quotation.winner",
      "Escolheu o fornecedor vencedor da cotação",
      quotationId,
    );
  }
  return res;
}
