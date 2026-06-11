import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth";
import { money } from "@/lib/endurance/money";
import BarcodeSvg from "../m/barcode-svg";
import EtiquetasPrint from "./etiquetas-print";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function EtiquetasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ items?: string }>;
}) {
  const { slug } = await params;
  const { items } = await searchParams;
  const session = await requireOrgAccess(slug);

  // items = "id:qty,id:qty"
  const parsed = (items ?? "")
    .split(",")
    .map((s) => s.split(":"))
    .filter(([id, q]) => id && Number(q) > 0)
    .map(([id, q]) => ({ id, qty: Math.min(Number(q), 200) }));

  const ids = parsed.map((p) => p.id);
  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids }, organizationId: session.org },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  // Expande cada produto na quantidade de etiquetas pedida.
  const labels: { name: string; price: number; barcode: string }[] = [];
  for (const it of parsed) {
    const p = byId.get(it.id);
    if (!p || !p.barcode) continue;
    for (let i = 0; i < it.qty; i++)
      labels.push({ name: p.name, price: money(p.price), barcode: p.barcode });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <EtiquetasPrint backHref={`/espaco/${slug}/m/codigo_barras`} />

      {labels.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500 dark:border-ink-700 dark:bg-ink-900">
          Nenhuma etiqueta selecionada. Volte e informe a quantidade.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3">
          {labels.map((l, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-center print:border-slate-300"
            >
              <p className="w-full truncate text-[11px] font-semibold text-slate-800">
                {l.name}
              </p>
              <p className="text-sm font-bold text-slate-900">{brl(l.price)}</p>
              <div className="mt-1">
                <BarcodeSvg value={l.barcode} moduleWidth={1.4} height={40} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
