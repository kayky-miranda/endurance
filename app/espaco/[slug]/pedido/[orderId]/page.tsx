import { notFound } from "next/navigation";
import { requireOrgAccess, sessionHasPermission } from "@/lib/auth";
import { getPurchaseOrderDetail } from "@/lib/endurance/purchasing";
import PedidoShare from "./pedido-share";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const session = await requireOrgAccess(slug);
  if (!sessionHasPermission(session, "suppliers.manage")) notFound();

  const o = await getPurchaseOrderDetail(session.org, orderId);
  if (!o) notFound();

  return (
    <div>
      <PedidoShare
        data={{
          slug,
          orderId: o.id,
          code: o.code,
          orgName: o.org.name,
          supplierName: o.supplier.name,
          phone: o.supplier.phone,
          email: o.supplier.email,
          items: o.items,
          total: o.total,
          note: o.note,
          sentAt: o.sentAt,
        }}
      />

      <div className="report mx-auto max-w-[640px] rounded-xl border border-slate-200 bg-white p-10 text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Pedido de compra
            </p>
            <h1 className="text-xl font-bold tracking-tight">{o.code}</h1>
            <p className="text-sm text-slate-500">{o.createdAt}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{o.org.name}</p>
            {(o.org.city || o.org.state) && (
              <p className="text-xs text-slate-500">
                {[o.org.city, o.org.state].filter(Boolean).join(" - ")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Fornecedor
          </p>
          <p className="font-semibold">{o.supplier.name}</p>
          <p className="text-sm text-slate-500">
            {[
              o.supplier.cnpj && `CNPJ ${o.supplier.cnpj}`,
              o.supplier.phone,
              o.supplier.email,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <th className="py-1.5 font-medium">Item</th>
              <th className="py-1.5 text-center font-medium">Qtd</th>
              <th className="py-1.5 text-right font-medium">Custo un.</th>
              <th className="py-1.5 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5">{it.name}</td>
                <td className="py-1.5 text-center">{it.quantity}</td>
                <td className="py-1.5 text-right">{brl(it.unitCost)}</td>
                <td className="py-1.5 text-right">
                  {brl(it.quantity * it.unitCost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold">
                Total
              </td>
              <td className="py-2 text-right font-bold">{brl(o.total)}</td>
            </tr>
          </tfoot>
        </table>

        {o.note && (
          <p className="mt-4 text-sm text-slate-500">
            <span className="font-medium text-slate-600">Observações:</span>{" "}
            {o.note}
          </p>
        )}

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
          Gerado por ENDURANCE — pedido de compra ao fornecedor.
        </p>
      </div>
    </div>
  );
}
