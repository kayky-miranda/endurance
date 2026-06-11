import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth";
import { money } from "@/lib/endurance/money";
import ReceiptActions from "./receipt-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAY_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ slug: string; saleId: string }>;
}) {
  const { slug, saleId } = await params;
  const session = await requireOrgAccess(slug);

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      payments: true,
      customer: true,
      seller: true,
      organization: true,
    },
  });
  if (!sale || sale.organizationId !== session.org) notFound();

  // Vendas novas guardam o troco em sale.change e os pagamentos líquidos (o
  // dinheiro entregue é líquido + troco). Vendas antigas guardavam o valor
  // entregue cheio — o troco é derivado de paid - total nesse caso.
  const change = money(sale.change);
  const paid = sale.payments.reduce((a, p) => a + money(p.amount), 0);
  const troco = change > 0 ? change : Math.max(0, paid - money(sale.total));
  const cashTendedExtra = change > 0 ? change : 0;
  const firstCashId = sale.payments.find((p) => p.method === "dinheiro")?.id;
  const when = sale.createdAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <ReceiptActions slug={slug} />

      <div className="receipt mx-auto max-w-[360px] rounded-xl border border-slate-200 bg-white p-6 font-mono text-xs text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">
            {sale.organization.name}
          </p>
          {(sale.organization.city || sale.organization.state) && (
            <p className="text-[11px] text-slate-500">
              {[sale.organization.city, sale.organization.state]
                .filter(Boolean)
                .join(" - ")}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            CUPOM NÃO FISCAL
          </p>
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5 text-[11px]">
          <Row label="Venda" value={`#${sale.id.slice(-6).toUpperCase()}`} />
          <Row label="Data" value={when} />
          {sale.seller && <Row label="Operador" value={sale.seller.name} />}
          <Row label="Cliente" value={sale.customer?.name ?? "Não identificado"} />
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-400">
              <th className="pb-1 font-medium">Item</th>
              <th className="pb-1 text-center font-medium">Qtd</th>
              <th className="pb-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-0.5 pr-2">
                  {it.name}
                  <span className="block text-[10px] text-slate-400">
                    {brl(money(it.unitPrice))} un.
                  </span>
                </td>
                <td className="py-0.5 text-center">{it.quantity}</td>
                <td className="py-0.5 text-right">
                  {brl(money(it.unitPrice) * it.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5">
          <Row label="Subtotal" value={brl(money(sale.subtotal))} />
          {money(sale.discount) > 0 && (
            <Row label="Desconto" value={`- ${brl(money(sale.discount))}`} />
          )}
          <div className="flex justify-between pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span>{brl(money(sale.total))}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5 text-[11px]">
          {sale.payments.map((p) => (
            <Row
              key={p.id}
              label={PAY_LABEL[p.method] ?? p.method}
              value={brl(
                money(p.amount) + (p.id === firstCashId ? cashTendedExtra : 0),
              )}
            />
          ))}
          {cashTendedExtra > 0 && !firstCashId && (
            <Row label="Dinheiro" value={brl(cashTendedExtra)} />
          )}
          {troco > 0 && <Row label="Troco" value={brl(troco)} />}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <p className="text-center text-[11px] text-slate-500">
          Obrigado pela preferência!
        </p>
        <p className="mt-1 text-center text-[10px] text-slate-400">
          Emitido por ENDURANCE
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
