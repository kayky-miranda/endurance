import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth";
import { formatChave } from "@/lib/endurance/fiscal";
import { PAY_LABEL } from "@/lib/endurance/fiscal-service";
import DanfeActions from "./danfe-actions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function DanfePage({
  params,
}: {
  params: Promise<{ slug: string; docId: string }>;
}) {
  const { slug, docId } = await params;
  const session = await requireOrgAccess(slug);

  const doc = await prisma.fiscalDocument.findUnique({
    where: { id: docId },
    include: {
      organization: true,
      sale: { include: { items: true, payments: true, customer: true } },
    },
  });
  if (!doc || doc.organizationId !== session.org) notFound();

  const cfg = await prisma.fiscalConfig.findUnique({
    where: { organizationId: session.org },
  });
  const sale = doc.sale;
<<<<<<< HEAD
<<<<<<< HEAD
  const docLabel = doc.modelo === "55" ? "NF-e" : "NFC-e";
=======
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
  const docLabel = doc.modelo === "55" ? "NF-e" : "NFC-e";
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
  const qrDataUrl = await QRCode.toDataURL(doc.qrCode, { margin: 1, width: 220 });
  const cancelada = doc.status === "cancelada";
  const when = doc.dataEmissao.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <DanfeActions slug={slug} />

      <div className="receipt mx-auto max-w-[360px] rounded-xl border border-slate-200 bg-white p-6 font-mono text-xs text-slate-800 shadow-sm print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">
            {cfg?.razaoSocial || doc.organization.name}
          </p>
          {cfg?.cnpj && (
            <p className="text-[11px] text-slate-500">CNPJ {cfg.cnpj}</p>
          )}
          {(cfg?.municipio || cfg?.uf) && (
            <p className="text-[11px] text-slate-500">
              {[cfg?.municipio, cfg?.uf].filter(Boolean).join(" - ")}
            </p>
          )}
          <p className="mt-1 text-[11px] font-semibold">
<<<<<<< HEAD
<<<<<<< HEAD
            Documento Auxiliar da {docLabel}
=======
            Documento Auxiliar da NFC-e
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
            Documento Auxiliar da {docLabel}
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
          </p>
        </div>

        {cancelada && (
          <p className="mt-2 rounded border border-red-300 py-1 text-center text-[11px] font-bold uppercase text-red-600">
<<<<<<< HEAD
<<<<<<< HEAD
            {docLabel} CANCELADA
=======
            NFC-e CANCELADA
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
            {docLabel} CANCELADA
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
          </p>
        )}
        {doc.ambiente === "2" && (
          <p className="mt-2 text-center text-[10px] font-semibold text-red-500">
            EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
          </p>
        )}

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
                    {brl(it.unitPrice)} un.
                  </span>
                </td>
                <td className="py-0.5 text-center">{it.quantity}</td>
                <td className="py-0.5 text-right">
                  {brl(it.unitPrice * it.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5">
          <Row label="Subtotal" value={brl(sale.subtotal)} />
          {sale.discount > 0 && (
            <Row label="Desconto" value={`- ${brl(sale.discount)}`} />
          )}
          <div className="flex justify-between pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span>{brl(sale.total)}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5 text-[11px]">
          {sale.payments.map((p) => (
            <Row
              key={p.id}
              label={PAY_LABEL[p.method] ?? p.method}
              value={brl(p.amount)}
            />
          ))}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-0.5 text-center text-[10px] text-slate-500">
          <p className="font-semibold text-slate-700">
<<<<<<< HEAD
<<<<<<< HEAD
            {docLabel} nº {doc.numero} · Série {doc.serie}
=======
            NFC-e nº {doc.numero} · Série {doc.serie}
>>>>>>> 4601ad18c1a383bb3f7086a9290822d31bf3f5fa
=======
            {docLabel} nº {doc.numero} · Série {doc.serie}
>>>>>>> b07ccfa (Resolve conflitos de merge (lado HEAD) e estabiliza o build)
          </p>
          <p>Emissão: {when}</p>
          <p className="break-all">
            Chave de acesso
            <span className="block font-semibold text-slate-700">
              {formatChave(doc.chave)}
            </span>
          </p>
          {doc.protocolo && <p>Protocolo de autorização: {doc.protocolo}</p>}
          {sale.customer?.document ? (
            <p>
              Consumidor: {sale.customer.name} — {sale.customer.document}
            </p>
          ) : (
            <p>CONSUMIDOR NÃO IDENTIFICADO</p>
          )}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="flex flex-col items-center">
          <p className="mb-1 text-[10px] text-slate-500">
            Consulte pela chave de acesso em
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Code NFC-e" className="h-40 w-40" />
        </div>

        <p className="mt-3 text-center text-[10px] text-slate-400">
          Emitido por ENDURANCE · Sistema Fiscal
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
